import { describe, expect, test } from 'bun:test'

process.env.NUVIX_JWT_SECRET ||= 'test-secret'
process.env.NUVIX_PLATFORM_DB_DRIVER ||= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ||= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ||= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

const { app } = await import('../src/app')

describe('composed server app', () => {
  test('GET /v2/health returns ok', async () => {
    const res = await app.handle(new Request('http://localhost/v2/health'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; version: string }
    expect(body.status).toBe('ok')
  })

  test('GET /v2/whoami returns guest and absent project when unauthenticated', async () => {
    const res = await app.handle(new Request('http://localhost/v2/whoami'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      auth: { type: string; roles: string[] }
      project: { status: string }
    }
    expect(body.auth.type).toBe('guest')
    expect(body.auth.roles).toEqual(['any', 'guests'])
    expect(body.project.status).toBe('absent')
  })

  test('tenant-scoped routes require publishable key', async () => {
    const res = await app.handle(
      new Request('http://localhost/v2/users', {
        method: 'GET',
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as {
      type: string
      status: number
      code: string
    }
    expect(body.code).toBe('publishable_key_required')
  })

  test('tenant-scoped routes return 404 for invalid publishable key', async () => {
    const res = await app.handle(
      new Request('http://localhost/v2/users', {
        method: 'GET',
        headers: {
          'x-nuvix-publishable-key': 'non-existent-project-key',
        },
      }),
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as {
      type: string
      status: number
      code: string
    }
    expect(body.code).toBe('project_not_found')
  })

  test('GET /v2/account requires publishable key', async () => {
    const res = await app.handle(new Request('http://localhost/v2/account'))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('publishable_key_required')
  })

  test('GET /v2/teams requires publishable key', async () => {
    const res = await app.handle(new Request('http://localhost/v2/teams'))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('publishable_key_required')
  })
})
