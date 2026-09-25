import { bootstrapAuthSchema } from '@nuvix/core/tenant-auth'
import {
  DockerTenantProvisioner,
  decodeEncryptionKey,
  TenantResourcePool,
} from '@nuvix/core/tenants'
import { config } from '@nuvix/utils'
import { Elysia, t } from 'elysia'
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
import { problemErrors } from './plugins/errors'
import { createPlatformDatabase } from './registry/setup'

/**
 * Framework glue — the ONLY place Elysia-specific wiring lives (mirrors
 * `apps/server/src/app.ts`). Infrastructure (database, provisioner) is
 * constructed once here and injected into services; routes never see it
 * directly (AGENTS.md).
 */

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

const db = await createPlatformDatabase()
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

const projects = new ProjectService(db, provisioner, bootstrapAuthSchema, jwtSecret, encryptionKey)
const webhooks = new WebhooksService(db)
const keys = new KeysService(db)
const platforms = new PlatformsService(db)
const authSettings = new AuthSettingsService(db)
const metadata = new MetadataService(db)
const templates = new TemplatesService(db)

const tenantPool = new TenantResourcePool()
const database = new DatabaseService(db, tenantPool)

export const app = new Elysia()
  .use(problemErrors())
  .use(projectRoutes(projects))
  .use(databaseRoutes(database))
  .use(webhookRoutes(webhooks))
  .use(keyRoutes(keys))
  .use(platformRoutes(platforms))
  .use(authSettingsRoutes(authSettings))
  .use(metadataRoutes(metadata))
  .use(templatesRoutes(templates))
  .use(health)
