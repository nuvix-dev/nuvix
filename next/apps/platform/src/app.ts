/** App composition for the platform (console/control-plane) server. */
import { parseRedisUrl, QueueManager } from '@nuvix/core/queues'
import { bootstrapAuthSchema } from '@nuvix/core/tenant-auth'
import {
  DockerTenantProvisioner,
  decodeEncryptionKey,
  TenantResourcePool,
} from '@nuvix/core/tenants'
import { config } from '@nuvix/utils'
import { Elysia, t } from 'elysia'
import { authRoutesFor } from './modules/auth/routes'
import { bootstrapConsoleUser, ConsoleAuthService } from './modules/auth/service'
import { authSettingsRoutes } from './modules/auth-settings/routes'
import { AuthSettingsService } from './modules/auth-settings/service'
import { databaseRoutes } from './modules/database/routes'
import { DatabaseService } from './modules/database/service'
import { keyRoutes } from './modules/keys/routes'
import { KeysService } from './modules/keys/service'
import { metadataRoutes } from './modules/metadata/routes'
import { MetadataService } from './modules/metadata/service'
import { platformRoutes } from './modules/platforms/routes'
import { PlatformsService } from './modules/platforms/service'
import { projectRoutes } from './modules/projects/routes'
import { ProjectService } from './modules/projects/service'
import { templatesRoutes } from './modules/templates/routes'
import { TemplatesService } from './modules/templates/service'
import { webhookRoutes } from './modules/webhooks/routes'
import { WebhooksService } from './modules/webhooks/service'
import { consoleAuth } from './plugins/auth'
import { problemErrors } from './plugins/errors'
import { createPlatformDatabase } from './registry/setup'

/**
 * Framework glue — the only place Elysia-specific wiring lives. Since the
 * server is the composition root, it constructs infrastructure (database,
 * provisioner, queue manager) once and injects it into services; routes
 * receive services only, never infrastructure.
 */

/** Unauthenticated liveness probe. */
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

/** Control-plane database, created and schema-bootstrapped at startup. */
const db = await createPlatformDatabase()
/** Creates one dedicated PostgreSQL container per project. */
const provisioner = new DockerTenantProvisioner({
  image: config.platform.tenantPostgresImage,
})

let encryptionKey: Uint8Array | undefined
try {
  encryptionKey = decodeEncryptionKey(config.platform.tenantEncryptionKey)
} catch {
  // Optional in environments where key is not yet set
}

let jwtSecret: string | undefined
try {
  jwtSecret = config.jwtSecret
} catch {
  // Optional in environments where secret is not yet set
}

/**
 * Queue runtime — project-creation requests enqueue here so provisioning
 * happens in a worker. Without Redis the manager degrades to in-memory
 * mode and project provisioning falls back to running inline.
 */
export const queues = new QueueManager({
  connection: Bun.env.NUVIX_REDIS_URL ? parseRedisUrl(Bun.env.NUVIX_REDIS_URL) : undefined,
})

const projects = new ProjectService(
  db,
  provisioner,
  bootstrapAuthSchema,
  jwtSecret,
  encryptionKey,
  // Background provisioning: enqueue when Redis is configured; otherwise
  // the service falls back to inline provisioning (tests / zero-infra dev).
  Bun.env.NUVIX_REDIS_URL ? async (projectId) => queues.enqueueProject({ projectId }) : undefined,
)
const webhooks = new WebhooksService(db)
const keys = new KeysService(db)
const platforms = new PlatformsService(db)
const authSettings = new AuthSettingsService(db)
const metadata = new MetadataService(db)
const templates = new TemplatesService(db)

/** Shared pool of tenant resources for per-project database browsing. */
const tenantPool = new TenantResourcePool()
const database = new DatabaseService(db, tenantPool)

// Console operators seeded from env (idempotent — runs once at boot).
await bootstrapConsoleUser(db)

export const app = new Elysia()
  .use(problemErrors())
  // Console auth: every route below (except /health and /console/auth*)
  // requires a valid access JWT.
  .use(consoleAuth({ secret: jwtSecret ?? '' }))
  .use(authRoutesFor(new ConsoleAuthService(db)))
  .use(projectRoutes(projects))
  .use(databaseRoutes(database))
  .use(webhookRoutes(webhooks))
  .use(keyRoutes(keys))
  .use(platformRoutes(platforms))
  .use(authSettingsRoutes(authSettings))
  .use(metadataRoutes(metadata))
  .use(templatesRoutes(templates))
  .use(health)
