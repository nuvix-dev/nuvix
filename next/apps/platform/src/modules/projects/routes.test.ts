process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { treaty } from '@elysia/eden'
import { FakeTenantProvisioner } from '@nuvix/core/tenants'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import { createPlatformDatabase } from '../../registry/setup'
import { projectRoutes } from './routes'
import { ProjectService } from './service'

const jwtSecret = 'test-jwt-secret-routes'

/**
 * Composed the same way as `app.ts`, but with `FakeTenantProvisioner` in
 * place of `DockerTenantProvisioner` — route/composition coverage should
 * never depend on a real Docker host (that's `docker-provisioner.integration.test.ts`'s job).
 */
async function buildApp() {
  const db = await createPlatformDatabase()
  // FakeTenantProvisioner's target isn't a real Postgres instance — never
  // attempt a real bootstrap connection against it in route tests.
  const service = new ProjectService(db, new FakeTenantProvisioner(), async () => {}, jwtSecret)
  const app = new Elysia().use(problemErrors()).use(projectRoutes(service))
  return treaty(app)
}

let client: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  client = await buildApp()
})

describe('project routes', () => {
  test('POST /projects creates an active project', async () => {
    const { data, status } = await client.projects.post({ name: 'Acme' })
    expect(status).toBe(200)
    expect(data?.name).toBe('Acme')
    expect(data?.status).toBe('active')
    expect(data?.publishableKey).toMatch(/^pk_[0-9a-f]{32}$/)
  })

  test('POST /projects rejects a missing name with 422', async () => {
    // @ts-expect-error — intentionally malformed body
    const { status } = await client.projects.post({})
    expect(status).toBe(422)
  })

  test('GET /projects lists with pagination meta', async () => {
    await client.projects.post({ name: 'Listed' })
    const { data, status } = await client.projects.get({
      query: { limit: 1, offset: 0 },
    })
    expect(status).toBe(200)
    expect(data?.data.length).toBe(1)
    expect(data?.meta.total).toBeGreaterThanOrEqual(1)
  })

  test('GET /projects/:projectId returns 404 as problem+json for an unknown id', async () => {
    const { status, error } = await client.projects({ projectId: 'missing' }).get()
    expect(status).toBe(404)
    expect(error?.value).toMatchObject({ code: 'project_not_found' })
  })

  test('PATCH /projects/:projectId updates project', async () => {
    const created = await client.projects.post({ name: 'Before Patch' })
    const id = created.data!.$id

    const { data, status } = await client
      .projects({ projectId: id })
      .patch({ name: 'After Patch', description: 'Updated desc' })
    expect(status).toBe(200)
    expect(data?.name).toBe('After Patch')
    expect(data?.description).toBe('Updated desc')
  })

  test('PATCH /projects/:projectId/service and /service/all updates service status', async () => {
    const created = await client.projects.post({ name: 'Service Route Test' })
    const id = created.data!.$id

    const res1 = await client
      .projects({ projectId: id })
      .service.patch({ service: 'storage', status: false })
    expect(res1.status).toBe(200)
    expect(res1.data?.services?.storage).toBe(false)

    const res2 = await client.projects({ projectId: id }).service.all.patch({ status: false })
    expect(res2.status).toBe(200)
    expect(res2.data?.services?.storage).toBe(false)
  })

  test('PATCH /projects/:projectId/api and /api/all updates api status', async () => {
    const created = await client.projects.post({ name: 'API Route Test' })
    const id = created.data!.$id

    const res1 = await client.projects({ projectId: id }).api.patch({ api: 'rest', status: false })
    expect(res1.status).toBe(200)
    expect(res1.data?.apis?.rest).toBe(false)

    const res2 = await client.projects({ projectId: id }).api.all.patch({ status: true })
    expect(res2.status).toBe(200)
    expect(res2.data?.apis?.rest).toBe(true)
  })

  test('PATCH /projects/:projectId/oauth2 updates oauth provider', async () => {
    const created = await client.projects.post({ name: 'OAuth Route Test' })
    const id = created.data!.$id

    const res = await client.projects({ projectId: id }).oauth2.patch({
      provider: 'google',
      appId: 'google-app-id',
      secret: 'google-secret',
      enabled: true,
    })
    expect(res.status).toBe(200)
  })

  test('PATCH /projects/:projectId/smtp updates smtp', async () => {
    const created = await client.projects.post({ name: 'SMTP Route Test' })
    const id = created.data!.$id

    const res = await client.projects({ projectId: id }).smtp.patch({
      enabled: true,
      senderName: 'Nuvix Support',
      senderEmail: 'support@nuvix.io',
      host: 'smtp.nuvix.io',
      port: 587,
    })
    expect(res.status).toBe(200)
    expect(res.data?.smtp?.enabled).toBe(true)
  })

  test('POST /projects/:projectId/jwts creates JWT token', async () => {
    const created = await client.projects.post({ name: 'JWT Route Test' })
    const id = created.data!.$id

    const res = await client
      .projects({ projectId: id })
      .jwts.post({ scopes: ['projects.read'], duration: 1800 })
    expect(res.status).toBe(200)
    expect(res.data?.jwt.startsWith('dynamic_')).toBe(true)
  })

  test('POST /projects/:projectId/smtp/tests returns 501 not implemented', async () => {
    const created = await client.projects.post({ name: 'SMTP Test Route' })
    const id = created.data!.$id

    const res = await client
      .projects({ projectId: id })
      .smtp.tests.post({ emails: ['test@example.com'], senderName: 'Admin' })
    expect(res.status).toBe(501)
  })

  test('GET /projects/:projectId/usage returns project usage', async () => {
    const created = await client.projects.post({ name: 'Usage Route Project' })
    const id = created.data!.$id

    const res = await client.projects({ projectId: id }).usage.get()
    expect(res.status).toBe(200)
    expect(res.data?.documentsTotal).toBe(0)
    expect(res.data?.usersTotal).toBe(0)
  })

  test('DELETE /projects/:projectId removes the project', async () => {
    const created = await client.projects.post({ name: 'ToRemove' })
    const id = created.data!.$id

    const del = await client.projects({ projectId: id }).delete()
    expect(del.status).toBe(204)

    const after = await client.projects({ projectId: id }).get()
    expect(after.status).toBe(404)
  })
})
