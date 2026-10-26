import { describe, expect, it } from 'bun:test'
import { signJwt } from '@nuvix/core/auth'
import type { TenantResource } from '@nuvix/core/tenants'
import { Doc } from '@nuvix/db'
import { Elysia } from 'elysia'
import { problemErrors } from '../plugins/errors'
import { logsRoutes } from './route'

process.env.NUVIX_JWT_SECRET ??= 'test-jwt-secret'

/** In-memory tenant session covering the api_logs read surface. */
function stubSession() {
  const store = new Map<string, Map<string, Doc<Record<string, unknown>>>>()
  const colOf = (name: string) => {
    let col = store.get(name)
    if (!col) {
      col = new Map()
      store.set(name, col)
    }
    return col
  }
  return {
    store,
    async count(collection: string, queries: Array<unknown> = []) {
      return (await this.find(collection, queries)).length
    },
    async find(collection: string, queries: Array<unknown> = []) {
      let all = [...colOf(collection).values()]
      for (const query of queries) {
        const q = query as {
          getAttribute?: () => string
          getMethod?: () => string
          values?: unknown[]
        }
        const attr = q.getAttribute?.()
        const values = q.values
        const method = q.getMethod?.()
        // Order queries: sort in-memory (orderDesc only, what the route uses).
        if (method === 'orderDesc' && attr) {
          all.sort((a, b) => String(b.get(attr)).localeCompare(String(a.get(attr))))
          continue
        }
        // Skip limit/offset (no attribute) — filter-only stub.
        if (attr && values && values.length > 0) {
          all = all.filter((d) => values.includes(d.get(attr)))
        }
      }
      return all
    },
  }
}

const LOG_ROWS = [
  {
    $id: 'l1',
    request_id: 'r1',
    method: 'GET',
    path: '/v2/account',
    status: 200,
    timestamp: '2026-10-26T10:00:00Z',
    resource: 'unknown',
  },
  {
    $id: 'l2',
    request_id: 'r2',
    method: 'POST',
    path: '/v2/account',
    status: 500,
    timestamp: '2026-10-26T11:00:00Z',
    resource: 'unknown',
    error: 'Error response (500)',
  },
]

function makeApp() {
  const session = stubSession()
  // Seed the same rows for every test (fresh session per test).
  const col = new Map<string, Doc<Record<string, unknown>>>()
  for (const row of LOG_ROWS) {
    col.set(row.$id, new Doc<Record<string, unknown>>(row))
  }
  session.store.set('api_logs', col)
  const tenantResource = {
    authSystemSession: () => session,
  } as unknown as TenantResource

  const testApp = new Elysia()
    .use(problemErrors())
    .derive('plugin', ({ request }) => ({
      tenantResource,
      // Mimic authContext's API-key leg (tests exercise both admin legs).
      auth: request.headers.has('x-nuvix-key')
        ? { type: 'apiKey', mode: 'admin' }
        : ({ type: 'guest' } as unknown),
    }))
    .use(logsRoutes({ jwtSecret: process.env.NUVIX_JWT_SECRET! }))

  return { testApp, session }
}

describe('GET /logs (server, admin-only)', () => {
  it('401s without any admin auth', async () => {
    const { testApp } = makeApp()
    const res = await testApp.handle(new Request('http://localhost/logs'))
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code?: string; type?: string }
    expect(body.code).toBe('logs_unauthorized')
    expect(body.type).toBe('/errors/unauthorized')
  })

  it('401s with a tenant JWT (audience separation: console leg only)', async () => {
    const { testApp } = makeApp()
    // A tenant-style JWT (no aud claim) must NOT satisfy the console leg.
    const tenantJwt = await signJwt(
      { sub: 'user_1', sessionId: 's1' },
      process.env.NUVIX_JWT_SECRET!,
      60,
    )
    const res = await testApp.handle(
      new Request('http://localhost/logs', {
        headers: { authorization: `Bearer ${tenantJwt}` },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('serves logs for a console operator JWT', async () => {
    const { testApp } = makeApp()
    const consoleJwt = await signJwt(
      { sub: 'op_1', email: 'op@test', aud: 'console' },
      process.env.NUVIX_JWT_SECRET!,
      60,
    )
    const res = await testApp.handle(
      new Request('http://localhost/logs', {
        headers: { authorization: `Bearer ${consoleJwt}` },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      total: number
      logs: Array<{ request_id: string }>
    }
    expect(body.total).toBe(2)
    expect(body.logs).toHaveLength(2)
  })

  it('serves logs for an API-key caller with filters', async () => {
    const { testApp } = makeApp()
    const res = await testApp.handle(
      new Request('http://localhost/logs?method=POST&limit=10', {
        headers: { 'x-nuvix-key': 'standard_whatever' },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      total: number
      logs: Array<{ method: string; status: number }>
    }
    expect(body.total).toBe(1)
    expect(body.logs[0]!.method).toBe('POST')
    expect(body.logs[0]!.status).toBe(500)
  })

  it('orders newest first and paginates', async () => {
    const { testApp } = makeApp()
    const res = await testApp.handle(
      new Request('http://localhost/logs?limit=1', {
        headers: { 'x-nuvix-key': 'standard_whatever' },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      total: number
      logs: Array<{ request_id: string }>
    }
    expect(body.total).toBe(2)
    // The 500 row (11:00) sorts before the 200 row (10:00).
    expect(body.logs[0]!.request_id).toBe('r2')
  })
})
