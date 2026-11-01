/** Composes server infrastructure, request context, plugins, and all project-facing API modules. */
import { openapi } from '@elysia/openapi'
import { createPlatformDatabase, KeyRegistry, ProjectRegistry } from '@nuvix/core/platform'
import { QueueManager } from '@nuvix/core/queues'
import { TenantResourcePool } from '@nuvix/core/tenants'
import { TranslationLoader } from '@nuvix/i18n'
import { config } from '@nuvix/utils'
import { Elysia, t } from 'elysia'
import { accountRoutes } from './account/route'
import { avatarRoutes } from './avatars/route'
import { createAvatarService } from './avatars/service'
import { authContext } from './context/auth'
import { createGeoIP } from './context/geoip'
import { getTranslator, localeContext } from './context/locale'
import { projectContext } from './context/project'
import { tenantContext } from './context/tenant'
import { databaseRoutes } from './database/route'
import { localeRoutes } from './locale/route'
import { createMailComposer } from './mail/composer'
import { messagingRoutes } from './messaging/route'
import { oauthPages } from './oauth-pages'
import { auditEnqueuerFrom, initAuditEmitter, initWebhookFanout } from './plugins/audit'
import { cors } from './plugins/cors'
import { problemErrors } from './plugins/errors'
import { rateLimit } from './plugins/rate-limit'
import { securityHeaders } from './plugins/security'
import { logsRoutes } from './request-logs/route'
import { type LogsEnqueuer, logsRequestSource } from './request-logs/source'
import { schemasRoutes } from './schemas/route'
import { type StatsEnqueuer, statsRequestSource, wireStatsDatabase } from './stats/source'
import { storageRoutes } from './storage/route'
import { teamRoutes } from './teams/route'
import { userRoutes } from './users/route'
import { createWebhookFanout } from './webhooks/dispatch'
import { parseRedisUrl } from './workers'

/** Keep Elysia-specific composition in one module while feature code remains plugin-oriented. */

// Translation assets live at the monorepo root (see docs/api/_i18n.md).
const translationsDir = new URL('../../../assets/locale/translations', import.meta.url).pathname
const i18nLoader = new TranslationLoader(translationsDir)
const localeOptions = {
  loader: i18nLoader,
  available: await i18nLoader.availableLocales(),
} as const

const health = new Elysia({ name: 'health' }).get(
  '/health',
  {
    response: t.Object({
      status: t.Literal('ok'),
      version: t.String(),
      uptime: t.Number(),
    }),
  },
  () => ({
    status: 'ok',
    version: '2.0.0-alpha.1',
    uptime: process.uptime(),
  }),
)

// Module services — constructed once at startup (graceful degradation built in).
const geoip = await createGeoIP()
const avatars = createAvatarService()

// Share the platform schema used by the platform app through one registry boundary.
const platformDb = await createPlatformDatabase({
  driver: config.platform.dbDriver,
  url: config.platform.dbUrl,
  encryptionKey: config.platform.tenantEncryptionKey,
})
const projectRegistry = new ProjectRegistry(platformDb)
const keyRegistry = new KeyRegistry(platformDb)

// Queue runtime — audits/mails/messaging/stats/webhooks enqueue here.
// Without a Redis connection the manager degrades to in-memory test mode.
export const queues = new QueueManager({
  // Tolerant at import time (tests compose the app without Redis); the
  // runtime entry (index.ts) enforces `NUVIX_REDIS_URL` outside tests.
  connection: Bun.env.NUVIX_REDIS_URL ? parseRedisUrl(Bun.env.NUVIX_REDIS_URL) : undefined,
})
initAuditEmitter(auditEnqueuerFrom(queues))
// Webhook fan-out shares the audit pipeline (post-success afterHandle).
initWebhookFanout(createWebhookFanout({ registry: projectRegistry, queues }))

// Usage metrics enqueue boundary (stats worker persists per tenant).
const statsEnqueuer: StatsEnqueuer = async (projectId, metrics) => {
  await queues.enqueueStats({ projectId, metrics })
}

// API request-log enqueue boundary (logs worker persists per tenant).
const logsEnqueuer: LogsEnqueuer = async (projectId, row) => {
  await queues.enqueueLog({ projectId, ...row })
}

// Tenant resources notify composition of their Database facades so usage listeners can attach.
const tenantPool = new TenantResourcePool({
  dependencies: {
    onDatabaseCreated: ({ projectId, database }) => {
      wireStatsDatabase({ projectId, database, enqueue: statsEnqueuer })
    },
  },
})
const tenantPlugin = tenantContext({
  projectLookup: projectRegistry,
  keyLookup: keyRegistry,
  tenantPool,
  jwtSecret: config.jwtSecret,
})

/** Mail composer — account services build/send system emails through it. */
export const mailComposer = createMailComposer({
  registry: projectRegistry,
  queues,
})

const v2 = new Elysia({ prefix: '/v2' })
  .use(
    cors({
      origin: config.isProd ? [] : true,
      allowedHeaders: [
        'content-type',
        'authorization',
        'x-nuvix-publishable-key',
        'x-nuvix-session',
        'x-nuvix-jwt',
        'x-nuvix-key',
        'x-nuvix-mode',
        'x-nuvix-locale',
      ],
    }),
  )
  .use(securityHeaders)
  .use(rateLimit({ max: 300, windowMs: 60_000 }))
  .use(
    problemErrors({
      getTranslator: (headers) => getTranslator(headers, localeOptions),
    }),
  )
  // Scalar UI at /v2/openapi, spec at /v2/openapi/json
  .use(
    openapi({
      documentation: { info: { title: 'Nuvix API', version: '2.0.0' } },
    }),
  )
  // Request pipeline order: publishable key -> platform project ->
  // tenant-local auth -> canonical roles -> caller-scoped `Session`.
  .use(projectContext({ lookup: projectRegistry }))
  .use(authContext({ jwtSecret: config.jwtSecret }))
  // Network usage metrics (requests + bytes) — every project response.
  .use(statsRequestSource({ enqueue: statsEnqueuer, enabled: () => config.stats.enabled }))
  // API request logs — every project response (admin traffic skipped).
  .use(logsRequestSource({ enqueue: logsEnqueuer }))
  .use(localeContext(localeOptions))
  .use(localeRoutes(geoip, localeOptions))
  .use(avatarRoutes(avatars))
  .use(
    new Elysia()
      .use(tenantPlugin)
      .use(logsRoutes({ jwtSecret: config.jwtSecret }))
      .use(
        userRoutes({
          jwtSecret: config.jwtSecret,
        }),
      )
      .use(
        accountRoutes({
          jwtSecret: config.jwtSecret,
          oauth2: {
            registry: projectRegistry,
            encryptionKey: config.platform.tenantEncryptionKey,
          },
          mail: mailComposer,
        }),
      )
      .use(teamRoutes())
      .use(storageRoutes())
      .use(messagingRoutes({ queues }))
      .use(databaseRoutes())
      .use(schemasRoutes()),
  )
  // Keep this diagnostic route downstream of context plugins so derived values are available to its handler.
  .get('/whoami', ({ auth, project }) => ({ auth, project }))
  .use(health)

/** Root app composing unversioned OAuth2 relay pages with the versioned project API. */
export const app = new Elysia().use(oauthPages()).use(v2)
