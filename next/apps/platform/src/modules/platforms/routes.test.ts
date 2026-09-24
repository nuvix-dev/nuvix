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
import { platformRoutes } from './routes'
import { PlatformsService } from './service'

async function buildApp() {
  const db = await createPlatformDatabase()
  const projectService = new ProjectService(db, new FakeTenantProvisioner(), async () => {})
  const platformsService = new PlatformsService(db)

  const app = new Elysia()
    .use(problemErrors())
    .use(projectRoutes(projectService))
    .use(platformRoutes(platformsService))

  return { client: treaty(app), projectService }
}

let client: Awaited<ReturnType<typeof buildApp>>['client']
let projectId: string

beforeAll(async () => {
  const built = await buildApp()
  client = built.client
  const project = await built.projectService.create({ name: 'Platforms Route Project' })
  projectId = project.$id
})

describe('platform routes', () => {
  test('POST /projects/:projectId/platforms creates a client platform', async () => {
    const { data, status } = await client.projects({ projectId }).platforms.post({
      type: 'web',
      name: 'Web Dashboard',
      hostname: 'console.example.com',
    })

    expect(status).toBe(200)
    expect(data?.name).toBe('Web Dashboard')
    expect(data?.type).toBe('web')
    expect(data?.hostname).toBe('console.example.com')
    expect(data?.projectId).toBe(projectId)
  })

  test('GET /projects/:projectId/platforms lists platforms', async () => {
    const { data, status } = await client.projects({ projectId }).platforms.get({
      query: { limit: 10, offset: 0 },
    })

    expect(status).toBe(200)
    expect(data?.data.length).toBeGreaterThanOrEqual(1)
    expect(data?.meta.total).toBeGreaterThanOrEqual(1)
  })

  test('GET /projects/:projectId/platforms/:platformId returns a single platform', async () => {
    const createRes = await client.projects({ projectId }).platforms.post({
      type: 'flutter',
      name: 'Single App',
      key: 'com.example.single',
    })
    expect(createRes.status).toBe(200)
    const platformId = createRes.data!.$id

    const { data, status } = await client.projects({ projectId }).platforms({ platformId }).get()

    expect(status).toBe(200)
    expect(data?.name).toBe('Single App')
    expect(data?.key).toBe('com.example.single')
  })

  test('PUT /projects/:projectId/platforms/:platformId updates a platform', async () => {
    const createRes = await client.projects({ projectId }).platforms.post({
      type: 'android',
      name: 'To Put',
    })
    const platformId = createRes.data!.$id

    const { data, status } = await client.projects({ projectId }).platforms({ platformId }).put({
      name: 'Put Platform',
      key: 'com.example.put',
    })

    expect(status).toBe(200)
    expect(data?.name).toBe('Put Platform')
    expect(data?.key).toBe('com.example.put')
  })

  test('PATCH /projects/:projectId/platforms/:platformId updates a platform', async () => {
    const createRes = await client.projects({ projectId }).platforms.post({
      type: 'apple-ios',
      name: 'To Patch',
    })
    const platformId = createRes.data!.$id

    const { data, status } = await client.projects({ projectId }).platforms({ platformId }).patch({
      name: 'Patched Platform',
    })

    expect(status).toBe(200)
    expect(data?.name).toBe('Patched Platform')
  })

  test('DELETE /projects/:projectId/platforms/:platformId deletes a platform', async () => {
    const createRes = await client.projects({ projectId }).platforms.post({
      type: 'web',
      name: 'To Delete',
    })
    const platformId = createRes.data!.$id

    const { status } = await client.projects({ projectId }).platforms({ platformId }).delete()

    expect(status).toBe(200)

    const getRes = await client.projects({ projectId }).platforms({ platformId }).get()
    expect(getRes.status).toBe(404)
  })
})
