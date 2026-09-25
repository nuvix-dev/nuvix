import { describe, expect, test } from 'bun:test'
import type { ResolvedApiKey, ResolvedProject } from '@nuvix/core/platform'
import type { TenantResource, TenantResourcePool } from '@nuvix/core/tenants'
import { Elysia } from 'elysia'
import type { ProjectLookup } from '../src/context/project'
import type { KeyLookup } from '../src/context/tenant'
import { tenantContext } from '../src/context/tenant'
import { problemErrors } from '../src/plugins/errors'

const ACTIVE_PROJECT: ResolvedProject = {
  id: 'proj_1',
  target: { host: '127.0.0.1', port: 5432, database: 'd', user: 'u', password: 'p' },
}

const VALID_API_KEY: ResolvedApiKey = {
  id: 'key_1',
  projectId: 'proj_1',
  name: 'Standard Key',
  scopes: ['users.read', 'users.write'],
}

const projectLookup: ProjectLookup = {
  resolve: async (key: string) => (key === 'pk_valid' ? ACTIVE_PROJECT : null),
}

const keyLookup: KeyLookup = {
  resolve: async (projectId, secret) => {
    if (projectId === 'proj_1' && secret === 'secret_valid') return VALID_API_KEY
    return null
  },
}

const fakeTenantResource = {
  authSystemSession: () => ({}),
} as unknown as TenantResource

const tenantPool = {
  get: async () => fakeTenantResource,
} as unknown as TenantResourcePool

const app = new Elysia({ prefix: '/v2' })
  .use(problemErrors())
  .use(tenantContext({ projectLookup, keyLookup, tenantPool }))
  .get('/test-tenant', ({ isAPIUser, isAdmin }) => ({ isAPIUser, isAdmin }))

function h(headers: Record<string, string>) {
  return { headers }
}

describe('tenantContext API key verification', () => {
  test('valid x-nuvix-key resolves API user and admin access', async () => {
    const res = await app.handle(
      new Request(
        'http://x/v2/test-tenant',
        h({
          'x-nuvix-publishable-key': 'pk_valid',
          'x-nuvix-key': 'secret_valid',
        }),
      ),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { isAPIUser: boolean; isAdmin: boolean }
    expect(body.isAPIUser).toBe(true)
    expect(body.isAdmin).toBe(true)
  })

  test('valid apikey in query param resolves API user and admin access', async () => {
    const res = await app.handle(
      new Request(
        'http://x/v2/test-tenant?apikey=secret_valid',
        h({ 'x-nuvix-publishable-key': 'pk_valid' }),
      ),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { isAPIUser: boolean; isAdmin: boolean }
    expect(body.isAPIUser).toBe(true)
    expect(body.isAdmin).toBe(true)
  })

  test('invalid API key rejects with 401 user_unauthorized', async () => {
    const res = await app.handle(
      new Request(
        'http://x/v2/test-tenant',
        h({
          'x-nuvix-publishable-key': 'pk_valid',
          'x-nuvix-key': 'fake_bogus_key',
        }),
      ),
    )
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code: string; status: number }
    expect(body.code).toBe('user_unauthorized')
    expect(body.status).toBe(401)
  })

  test('unconfigured keyLookup rejects with 401 when API key is provided', async () => {
    const bareApp = new Elysia({ prefix: '/v2' })
      .use(problemErrors())
      .use(tenantContext({ projectLookup, tenantPool }))
      .get('/test-tenant', ({ isAPIUser, isAdmin }) => ({ isAPIUser, isAdmin }))

    const res = await bareApp.handle(
      new Request(
        'http://x/v2/test-tenant',
        h({
          'x-nuvix-publishable-key': 'pk_valid',
          'x-nuvix-key': 'any_key',
        }),
      ),
    )
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('user_unauthorized')
  })
})
