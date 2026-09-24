process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { treaty } from '@elysia/eden'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import { createPlatformDatabase } from '../../registry/setup'
import { templatesRoutes } from './routes'
import { TemplatesService } from './service'

async function buildApp() {
  const db = await createPlatformDatabase()
  const service = new TemplatesService(db)
  const app = new Elysia().use(problemErrors()).use(templatesRoutes(service))
  return treaty(app)
}

let client: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  client = await buildApp()
})

describe('templates routes', () => {
  test('GET /projects/:projectId/templates/sms/:type/:locale returns 501', async () => {
    const res = await client
      .projects({ projectId: 'test-p' })
      .templates.sms({ type: 'invitation' })({ locale: 'en' })
      .get()
    expect(res.status).toBe(501)
  })

  test('PATCH /projects/:projectId/templates/sms/:type/:locale returns 501', async () => {
    const res = await client
      .projects({ projectId: 'test-p' })
      .templates.sms({ type: 'invitation' })({ locale: 'en' })
      .patch({})
    expect(res.status).toBe(501)
  })

  test('DELETE /projects/:projectId/templates/sms/:type/:locale returns 501', async () => {
    const res = await client
      .projects({ projectId: 'test-p' })
      .templates.sms({ type: 'invitation' })({ locale: 'en' })
      .delete()
    expect(res.status).toBe(501)
  })

  test('GET /projects/:projectId/templates/email/:type/:locale returns 501', async () => {
    const res = await client
      .projects({ projectId: 'test-p' })
      .templates.email({ type: 'invitation' })({ locale: 'en' })
      .get()
    expect(res.status).toBe(501)
  })

  test('PATCH /projects/:projectId/templates/email/:type/:locale returns 501', async () => {
    const res = await client
      .projects({ projectId: 'test-p' })
      .templates.email({ type: 'invitation' })({ locale: 'en' })
      .patch({})
    expect(res.status).toBe(501)
  })

  test('DELETE /projects/:projectId/templates/email/:type/:locale returns 501', async () => {
    const res = await client
      .projects({ projectId: 'test-p' })
      .templates.email({ type: 'invitation' })({ locale: 'en' })
      .delete()
    expect(res.status).toBe(501)
  })
})
