process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { treaty } from '@elysia/eden'
import { FakeTenantProvisioner } from '@nuvix/core/tenants'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import { createPlatformDatabase } from '../../registry/setup'
import { projectRoutes } from '../projects/routes'
import { ProjectService } from '../projects/service'
import { authSettingsRoutes } from './routes'
import { AuthSettingsService } from './service'

async function buildApp() {
  const db = await createPlatformDatabase()
  const projectService = new ProjectService(db, new FakeTenantProvisioner(), async () => {})
  const authSettingsService = new AuthSettingsService(db)

  const app = new Elysia()
    .use(problemErrors())
    .use(projectRoutes(projectService))
    .use(authSettingsRoutes(authSettingsService))

  return { client: treaty(app), projectService }
}

let client: Awaited<ReturnType<typeof buildApp>>['client']
let projectId: string

beforeAll(async () => {
  const built = await buildApp()
  client = built.client
  const project = await built.projectService.create({ name: 'Auth Settings Route Project' })
  projectId = project.$id
})

describe('auth settings routes', () => {
  test('GET /projects/:projectId/auth retrieves auth settings', async () => {
    const { data, status } = await client.projects({ projectId }).auth.get()
    expect(status).toBe(200)
    expect(data).toBeDefined()
  })

  test('PATCH /projects/:projectId/auth/session-alerts updates alerts', async () => {
    const { data, status } = await client
      .projects({ projectId })
      .auth['session-alerts'].patch({ alerts: true })

    expect(status).toBe(200)
    expect((data as Record<string, unknown>).sessionAlerts).toBe(true)
  })

  test('PATCH /projects/:projectId/auth/limit updates limit', async () => {
    const { data, status } = await client.projects({ projectId }).auth.limit.patch({ limit: 100 })

    expect(status).toBe(200)
    expect((data as Record<string, unknown>).limit).toBe(100)
  })

  test('PATCH /projects/:projectId/auth/duration updates duration', async () => {
    const { data, status } = await client
      .projects({ projectId })
      .auth.duration.patch({ duration: 3600 })

    expect(status).toBe(200)
    expect((data as Record<string, unknown>).duration).toBe(3600)
  })

  test('PATCH /projects/:projectId/auth/password-history updates history', async () => {
    const { data, status } = await client
      .projects({ projectId })
      .auth['password-history'].patch({ limit: 3 })

    expect(status).toBe(200)
    expect((data as Record<string, unknown>).passwordHistory).toBe(3)
  })

  test('PATCH /projects/:projectId/auth/personal-data updates personal data check', async () => {
    const { data, status } = await client
      .projects({ projectId })
      .auth['personal-data'].patch({ enabled: true })

    expect(status).toBe(200)
    expect((data as Record<string, unknown>).personalDataCheck).toBe(true)
  })

  test('PATCH /projects/:projectId/auth/methods/:method updates auth method', async () => {
    const { data, status } = await client
      .projects({ projectId })
      .auth.methods({ method: 'anonymous' })
      .patch({ status: false })

    expect(status).toBe(200)
    expect((data as Record<string, unknown>).anonymous).toBe(false)
  })
})
