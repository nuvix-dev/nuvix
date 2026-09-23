import { openapi } from '@elysia/openapi'
import { createPlatformDatabase, ProjectRegistry } from '@nuvix/core/platform'
import { TenantResourcePool } from '@nuvix/core/tenants'
import { TranslationLoader } from '@nuvix/i18n'
import { Local } from '@nuvix/storage'
import { config } from '@nuvix/utils'
import { Elysia, t } from 'elysia'
import { avatarRoutes } from './avatars/route'
import { createAvatarService } from './avatars/service'
import { createGeoIP } from './context/geoip'
import { getTranslator, localeContext } from './context/locale'
import { getTenantRequestContext, requireTenantContext, tenantContext } from './context/tenant'
import { localeRoutes } from './locale/route'
import { accountRoutes } from './modules/account/routes'
import { AccountService } from './modules/account/service'
import { databaseRoutes } from './modules/database/routes'
import { DatabaseService } from './modules/database/service'
import { MessagesService } from './modules/messaging/messages.service'
import { ProvidersService } from './modules/messaging/providers.service'
import { messagingRoutes } from './modules/messaging/routes'
import { SubscribersService } from './modules/messaging/subscribers.service'
import { TopicsService } from './modules/messaging/topics.service'
import { SessionsService } from './modules/sessions/service'
import { storageRoutes } from './modules/storage/routes'
import { StorageService } from './modules/storage/service'
import { teamRoutes } from './modules/teams/routes'
import { TeamsService } from './modules/teams/service'
import { userRoutes } from './modules/users/routes'
import { UserService } from './modules/users/service'
import { cors } from './plugins/cors'
import { problemErrors } from './plugins/errors'
import { rateLimit } from './plugins/rate-limit'
import { securityHeaders } from './plugins/security'

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
const storageDevice = new Local(config.storage.uploadsDir)

// Shared control-plane registry boundary (D38/Phase 7): the server app reads
// the SAME platform schema the platform app writes, through the one
// `@nuvix/core/platform` bootstrap function — never a second definition.
const platformDb = await createPlatformDatabase({
  driver: config.platform.dbDriver,
  url: config.platform.dbUrl,
  encryptionKey: config.platform.tenantEncryptionKey,
})
const projectRegistry = new ProjectRegistry(platformDb)
const tenantPool = new TenantResourcePool()

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
  // Request order (AGENTS.md): publishable key -> platform project ->
  // PostgreSQL tenant -> tenant-local auth -> canonical roles -> caller-scoped Session.
  .use(
    tenantContext({
      lookup: projectRegistry,
      pool: tenantPool,
      jwtSecret: config.jwtSecret,
    }),
  )
  .use(localeContext(localeOptions))
  .use(localeRoutes(geoip, localeOptions))
  .use(avatarRoutes(avatars))
  .use(
    accountRoutes(
      (request) => new AccountService(requireTenantContext(request).authSession),
      config.jwtSecret,
      (request) => {
        const { auth } = requireTenantContext(request)
        return { userId: auth.userId, sessionId: auth.sessionId }
      },
      (request) => ({
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      }),
      (request) => new SessionsService(requireTenantContext(request).authSession),
    ),
  )
  .use(userRoutes((request) => new UserService(requireTenantContext(request).authSession)))
  .use(
    teamRoutes(
      (request) => new TeamsService(requireTenantContext(request).authSession),
      (request) => {
        const { auth } = requireTenantContext(request)
        return { userId: auth.userId, roles: auth.roles }
      },
    ),
  )
  .use(
    databaseRoutes(
      (request) => new DatabaseService(requireTenantContext(request).resource.getSql()),
      (request) => {
        const { auth } = requireTenantContext(request)
        return {
          roles: auth.roles,
          isAdmin:
            auth.roles?.includes('admin') ||
            auth.roles?.includes('role:admin') ||
            auth.roles?.includes('owner'),
          isApiKey: auth.type === 'apiKey',
        }
      },
    ),
  )
  .use(
    storageRoutes(
      (request) => new StorageService(requireTenantContext(request).authSession, storageDevice),
      (request) => {
        const { auth } = requireTenantContext(request)
        return {
          roles: auth.roles,
          userId: auth.userId,
          isAdmin:
            auth.roles?.includes('admin') ||
            auth.roles?.includes('role:admin') ||
            auth.roles?.includes('owner'),
          isApiKey: auth.type === 'apiKey',
        }
      },
    ),
  )
  .use(
    messagingRoutes({
      providers: (request) => new ProvidersService(requireTenantContext(request).authSession),
      topics: (request) => new TopicsService(requireTenantContext(request).authSession),
      subscribers: (request) => new SubscribersService(requireTenantContext(request).authSession),
      messages: (request) => new MessagesService(requireTenantContext(request).authSession),
      getCallerAuth: (request) => {
        const { auth } = requireTenantContext(request)
        return {
          isAdmin:
            auth.roles?.includes('admin') ||
            auth.roles?.includes('role:admin') ||
            auth.roles?.includes('owner') ||
            false,
          isKey: auth.type === 'apiKey',
          userId: auth.userId,
          roles: auth.roles ?? [],
        }
      },
    }),
  )
  // Dev-only route exercising the context chain; removed once real modules land.
  .get('/whoami', ({ request }) => {
    const ctx = getTenantRequestContext(request)
    return { auth: ctx?.auth, project: ctx?.project }
  })
  .use(health)
