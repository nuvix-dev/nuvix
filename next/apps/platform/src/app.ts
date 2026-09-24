import { DockerTenantProvisioner } from '@nuvix/core/tenants'
import { config } from '@nuvix/utils'
import { Elysia, t } from 'elysia'
import { projectRoutes } from './modules/projects/routes'
import { ProjectService } from './modules/projects/service'
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
const projects = new ProjectService(db, provisioner)
const webhooks = new WebhooksService(db)

export const app = new Elysia()
  .use(problemErrors())
  .use(projectRoutes(projects))
  .use(webhookRoutes(webhooks))
  .use(health)
