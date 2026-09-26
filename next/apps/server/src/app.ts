import { openapi } from '@elysia/openapi'
import { createPlatformDatabase, KeyRegistry, ProjectRegistry } from '@nuvix/core/platform'
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
import { messagingRoutes } from './messaging/route'
import { cors } from './plugins/cors'
import { problemErrors } from './plugins/errors'
import { rateLimit } from './plugins/rate-limit'
import { securityHeaders } from './plugins/security'
import { schemasRoutes } from './schemas/route'
import { storageRoutes } from './storage/route'
import { teamRoutes } from './teams/route'
import { userRoutes } from './users/route'

/**
 * Framework glue — the ONLY place Elysia-specific wiring lives.
 * Routes are composed as plugins and mounted here.
 */

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

// Shared control-plane registry boundary (D38/Phase 7): the server app reads
// the SAME platform schema the platform app writes, through the one
// `@nuvix/core/platform` bootstrap function — never a second definition.
const platformDb = await createPlatformDatabase({
  driver: config.platform.dbDriver,
  url: config.platform.dbUrl,
  encryptionKey: config.platform.tenantEncryptionKey,
})
const projectRegistry = new ProjectRegistry(platformDb)
const keyRegistry = new KeyRegistry(platformDb)
const tenantPool = new TenantResourcePool()
const tenantPlugin = tenantContext({
  projectLookup: projectRegistry,
  keyLookup: keyRegistry,
  tenantPool,
  jwtSecret: config.jwtSecret,
})

export const app = new Elysia({ prefix: '/v2' })
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
  // Request order (AGENTS.md): publishable key -> platform project -> ...
  // -> tenant-local auth -> canonical roles -> caller-scoped Session.
  .use(projectContext({ lookup: projectRegistry }))
  .use(authContext({ jwtSecret: config.jwtSecret }))
  .use(localeContext(localeOptions))
  .use(localeRoutes(geoip, localeOptions))
  .use(avatarRoutes(avatars))
  .use(
    new Elysia()
      .use(tenantPlugin)
      .use(userRoutes({ jwtSecret: config.jwtSecret }))
      .use(accountRoutes({ jwtSecret: config.jwtSecret }))
      .use(teamRoutes())
      .use(storageRoutes())
      .use(messagingRoutes())
      .use(databaseRoutes())
      .use(schemasRoutes()),
  )
  // Dev-only route exercising the context chain; removed once real modules land.
  // NOTE: defined inline AFTER authContext/projectContext so the derived
  // types flow in ('plugin'-scoped derive types only reach routes registered
  // downstream).
  .get('/whoami', ({ auth, project }) => ({ auth, project }))
  .use(health)
