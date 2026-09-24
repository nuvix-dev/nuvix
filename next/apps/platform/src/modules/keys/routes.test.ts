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
import { keyRoutes } from './routes'
import { KeysService } from './service'

async function buildApp() {
  const db = await createPlatformDatabase()
  const projectService = new ProjectService(db, new FakeTenantProvisioner(), async () => {})
  const keysService = new KeysService(db)

  const app = new Elysia()
    .use(problemErrors())
    .use(projectRoutes(projectService))
    .use(keyRoutes(keysService))

  return { client: treaty(app), projectService }
}

let client: Awaited<ReturnType<typeof buildApp>>['client']
let projectId: string

beforeAll(async () => {
  const built = await buildApp()
  client = built.client
  const project = await built.projectService.create({ name: 'Keys Route Project' })
  projectId = project.$id
})

describe('key routes', () => {
  test('POST /projects/:projectId/keys creates an API key', async () => {
    const { data, status } = await client.projects({ projectId }).keys.post({
      name: 'Backend Service Key',
      scopes: ['users.read', 'teams.read'],
    })

    expect(status).toBe(200)
    expect(data?.name).toBe('Backend Service Key')
    expect(data?.projectId).toBe(projectId)
    expect(data?.secret).toMatch(/^standard_[0-9a-f]{256}$/)
    expect(data?.scopes).toEqual(['users.read', 'teams.read'])
  })

  test('GET /projects/:projectId/keys lists keys', async () => {
    const { data, status } = await client.projects({ projectId }).keys.get({
      query: { limit: 10, offset: 0 },
    })

    expect(status).toBe(200)
    expect(data?.data.length).toBeGreaterThanOrEqual(1)
    expect(data?.meta.total).toBeGreaterThanOrEqual(1)
  })

  test('GET /projects/:projectId/keys/:keyId returns a single key', async () => {
    const createRes = await client.projects({ projectId }).keys.post({
      name: 'Single Key',
      scopes: ['*'],
    })
    expect(createRes.status).toBe(200)
    const keyId = createRes.data!.$id

    const { data, status } = await client.projects({ projectId }).keys({ keyId }).get()

    expect(status).toBe(200)
    expect(data?.name).toBe('Single Key')
    expect(data?.secret).toBe(createRes.data!.secret)
  })

  test('PUT /projects/:projectId/keys/:keyId updates a key', async () => {
    const createRes = await client.projects({ projectId }).keys.post({
      name: 'To Put',
      scopes: ['*'],
    })
    const keyId = createRes.data!.$id

    const { data, status } = await client
      .projects({ projectId })
      .keys({ keyId })
      .put({
        name: 'Put Key',
        scopes: ['storage.read'],
      })

    expect(status).toBe(200)
    expect(data?.name).toBe('Put Key')
    expect(data?.scopes).toEqual(['storage.read'])
  })

  test('PATCH /projects/:projectId/keys/:keyId updates a key', async () => {
    const createRes = await client.projects({ projectId }).keys.post({
      name: 'To Patch',
      scopes: ['*'],
    })
    const keyId = createRes.data!.$id

    const { data, status } = await client.projects({ projectId }).keys({ keyId }).patch({
      name: 'Patched Key',
    })

    expect(status).toBe(200)
    expect(data?.name).toBe('Patched Key')
  })

  test('DELETE /projects/:projectId/keys/:keyId deletes a key', async () => {
    const createRes = await client.projects({ projectId }).keys.post({
      name: 'To Delete Key',
      scopes: ['*'],
    })
    const keyId = createRes.data!.$id

    const { status } = await client.projects({ projectId }).keys({ keyId }).delete()
    expect(status).toBe(200)

    const getRes = await client.projects({ projectId }).keys({ keyId }).get()
    expect(getRes.status).toBe(404)
  })
})
