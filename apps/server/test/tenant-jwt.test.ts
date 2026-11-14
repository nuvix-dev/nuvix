/** Tests for tenant-local JWT authentication and console-audience separation. */
import { signJwt } from '@nuvix/core/auth'
import type { ResolvedProject } from '@nuvix/core/platform'
import type { TenantResource, TenantResourcePool } from '@nuvix/core/tenants'
import type { Doc, Session } from '@nuvix/db'
import { Elysia } from 'elysia'
import { describe, expect, test } from 'bun:test'
import type { ProjectLookup } from '../src/context/project'
import { tenantContext } from '../src/context/tenant'
import type { Users } from '../src/types/generated'
import { problemErrors } from '../src/plugins/errors'

const JWT_SECRET = 'test-tenant-jwt-secret'
const ACTIVE_PROJECT: ResolvedProject = {
  id: 'proj_1',
  target: { host: '127.0.0.1', port: 5432, database: 'd', user: 'u', password: 'p' },
}

const projectLookup: ProjectLookup = {
  resolve: async (key: string) => (key === 'pk_valid' ? ACTIVE_PROJECT : null),
}

/** Minimal user stand-in: non-empty, stable id, no memberships/labels. */
const fakeUserDoc = {
  empty: () => false,
  getId: () => 'user_1',
  get: (key: string) => {
    if (key === 'sessions') return []
    if (key === 'memberships') return []
    if (key === 'labels') return []
    return undefined
  },
} as unknown as Doc<Users>

const fakeTenantResource = {
  authSystemSession: () => ({
    getDocument: async () => fakeUserDoc,
  }),
  authSession: () => ({}) as unknown as Session,
} as unknown as TenantResource

const tenantPool = {
  get: async () => fakeTenantResource,
} as unknown as TenantResourcePool

const app = new Elysia({ prefix: '/v2' })
  .use(problemErrors())
  .use(tenantContext({ projectLookup, tenantPool, jwtSecret: JWT_SECRET }))
  .get('/test-jwt', ({ user }) => ({ userId: (user as Doc<Users>).getId() }))

function h(headers: Record<string, string>) {
  return { headers }
}

async function jwtRequest(token: string) {
  return app.handle(
    new Request(
      'http://x/v2/test-jwt',
      h({
        'x-nuvix-publishable-key': 'pk_valid',
        'x-nuvix-jwt': token,
      }),
    ),
  )
}

describe('tenantContext JWT verification', () => {
  test('tenant-issued JWT (no audience) authenticates as its subject', async () => {
    const token = await signJwt({ sub: 'user_1', sid: 'sess_1' }, JWT_SECRET, 900)
    const res = await jwtRequest(token)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { userId: string }
    expect(body.userId).toBe('user_1')
  })

  test('console-audience JWT never authenticates as a tenant user', async () => {
    // Same secret as the server — the shared-signing-key cross-realm case.
    const consoleToken = await signJwt({ sub: 'user_1', aud: 'console' }, JWT_SECRET, 900)
    const res = await jwtRequest(consoleToken)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code: string; status: number }
    expect(body.code).toBe('user_jwt_invalid')
    expect(body.status).toBe(401)
  })

  test('JWT signed with a foreign secret stays guest', async () => {
    const foreign = await signJwt({ sub: 'user_1' }, 'wrong-secret', 900)
    const res = await jwtRequest(foreign)
    // verifyJwt returns null → no user resolves → route sees an empty guest Doc.
    expect(res.status).toBe(200)
    const body = (await res.json()) as { userId: string | null }
    expect(body.userId).toBeNull()
  })
})
