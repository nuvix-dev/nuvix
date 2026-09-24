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
import { webhookRoutes } from './routes'
import { WebhooksService } from './service'

async function buildApp() {
  const db = await createPlatformDatabase()
  const projectService = new ProjectService(db, new FakeTenantProvisioner(), async () => {})
  const webhooksService = new WebhooksService(db)

  const app = new Elysia()
    .use(problemErrors())
    .use(projectRoutes(projectService))
    .use(webhookRoutes(webhooksService))

  return { client: treaty(app), projectService }
}

let client: Awaited<ReturnType<typeof buildApp>>['client']
let projectId: string

beforeAll(async () => {
  const built = await buildApp()
  client = built.client
  const project = await built.projectService.create({ name: 'Webhooks Route Project' })
  projectId = project.$id
})

describe('webhook routes', () => {
  test('POST /projects/:projectId/webhooks creates a webhook', async () => {
    const { data, status } = await client.projects({ projectId }).webhooks.post({
      name: 'Deploy Hook',
      url: 'https://api.example.com/deploy',
      events: ['projects.create'],
    })

    expect(status).toBe(200)
    expect(data?.name).toBe('Deploy Hook')
    expect(data?.url).toBe('https://api.example.com/deploy')
    expect(data?.projectId).toBe(projectId)
    expect(data?.signatureKey).toBeDefined()
  })

  test('GET /projects/:projectId/webhooks lists webhooks', async () => {
    const { data, status } = await client.projects({ projectId }).webhooks.get({
      query: { limit: 10, offset: 0 },
    })

    expect(status).toBe(200)
    expect(data?.data.length).toBeGreaterThanOrEqual(1)
    expect(data?.meta.total).toBeGreaterThanOrEqual(1)
  })

  test('GET /projects/:projectId/webhooks/:webhookId returns a single webhook', async () => {
    const createRes = await client.projects({ projectId }).webhooks.post({
      name: 'Single Hook',
      url: 'https://api.example.com/single',
      events: ['*'],
    })
    expect(createRes.status).toBe(200)
    const webhookId = createRes.data!.$id

    const { data, status } = await client.projects({ projectId }).webhooks({ webhookId }).get()

    expect(status).toBe(200)
    expect(data?.name).toBe('Single Hook')
  })

  test('PATCH /projects/:projectId/webhooks/:webhookId updates a webhook', async () => {
    const createRes = await client.projects({ projectId }).webhooks.post({
      name: 'To Patch',
      url: 'https://api.example.com/patch',
      events: ['*'],
    })
    const webhookId = createRes.data!.$id

    const { data, status } = await client.projects({ projectId }).webhooks({ webhookId }).patch({
      name: 'Patched Hook',
      enabled: false,
    })

    expect(status).toBe(200)
    expect(data?.name).toBe('Patched Hook')
    expect(data?.enabled).toBe(false)
  })

  test('PUT /projects/:projectId/webhooks/:webhookId updates a webhook', async () => {
    const createRes = await client.projects({ projectId }).webhooks.post({
      name: 'To Put',
      url: 'https://api.example.com/put',
      events: ['*'],
    })
    const webhookId = createRes.data!.$id

    const { data, status } = await client.projects({ projectId }).webhooks({ webhookId }).put({
      name: 'Put Hook',
      enabled: true,
    })

    expect(status).toBe(200)
    expect(data?.name).toBe('Put Hook')
    expect(data?.enabled).toBe(true)
  })

  test('PATCH /projects/:projectId/webhooks/:webhookId/signature rotates signature key', async () => {
    const createRes = await client.projects({ projectId }).webhooks.post({
      name: 'Sig Rotate',
      url: 'https://api.example.com/sig',
      events: ['*'],
    })
    const webhookId = createRes.data!.$id
    const originalKey = createRes.data!.signatureKey

    const { data, status } = await client
      .projects({ projectId })
      .webhooks({ webhookId })
      .signature.patch()

    expect(status).toBe(200)
    expect(data?.signatureKey).toBeDefined()
    expect(data?.signatureKey).not.toBe(originalKey)
  })

  test('DELETE /projects/:projectId/webhooks/:webhookId deletes a webhook', async () => {
    const createRes = await client.projects({ projectId }).webhooks.post({
      name: 'To Delete',
      url: 'https://api.example.com/delete',
      events: ['*'],
    })
    const webhookId = createRes.data!.$id

    const { status } = await client.projects({ projectId }).webhooks({ webhookId }).delete()

    expect(status).toBe(200)

    const getRes = await client.projects({ projectId }).webhooks({ webhookId }).get()

    expect(getRes.status).toBe(404)
  })
})
