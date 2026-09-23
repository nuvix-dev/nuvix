import { describe, expect, it, mock } from 'bun:test'
import type { TenantResource, TenantResourcePool } from '@nuvix/core/tenants'
import { Doc, type Session } from '@nuvix/db'
import { HEADERS } from '../shared/constants'
import { signJwt } from '../utils/jwt'
import type { ProjectContext } from './project'
import { resolveTenantContext } from './tenant'

describe('resolveTenantContext', () => {
  it('returns guest roles when project is not resolved', async () => {
    const headers = new Headers()
    const projectContext: ProjectContext = { status: 'absent' }
    const mockPool = {} as unknown as TenantResourcePool

    const { tenant, auth } = await resolveTenantContext(headers, projectContext, mockPool)

    expect(auth.type).toBe('guest')
    expect(tenant.roles).toEqual(['any', 'guests'])
    expect(tenant.db).toBeUndefined()
  })

  it('resolves session auth and canonical roles when valid session header provided', async () => {
    const headers = new Headers()
    headers.set(HEADERS.session, 'valid-secret')

    const projectContext: ProjectContext = {
      status: 'resolved',
      project: {
        id: 'proj_1',
        target: {
          host: 'localhost',
          port: 5432,
          database: 'db_1',
          user: 'u',
          password: 'p',
        },
      },
    }

    const mockSessionDoc = new Doc({
      $id: 'sess_1',
      userId: 'usr_alice',
      expire: new Date(Date.now() + 100000).toISOString(),
      factors: ['email'],
    })

    const mockUserDoc = new Doc({
      $id: 'usr_alice',
      status: true,
    })

    const mockAuthSession = {
      findOne: mock(() => Promise.resolve(mockSessionDoc)),
      getDocument: mock(() => Promise.resolve(mockUserDoc)),
    } as unknown as Session

    const mockResource = {
      authSession: mock(() => mockAuthSession),
      session: mock(() => mockAuthSession),
    } as unknown as TenantResource

    const mockPool = {
      get: mock(() => Promise.resolve(mockResource)),
    } as unknown as TenantResourcePool

    const { tenant, auth } = await resolveTenantContext(headers, projectContext, mockPool)

    expect(auth.type).toBe('session')
    expect(auth.userId).toBe('usr_alice')
    expect(auth.sessionId).toBe('sess_1')
    expect(auth.roles).toEqual(['any', 'users', 'user:usr_alice'])
    expect(tenant.db).toBeDefined()
    expect(tenant.authSession).toBeDefined()
  })

  it('resolves JWT auth when valid JWT header is provided', async () => {
    const jwtSecret = 'super-secret-jwt-key'
    const jwt = await signJwt({ sub: 'usr_bob', sid: 'sess_bob' }, jwtSecret, 300)

    const headers = new Headers()
    headers.set(HEADERS.jwt, jwt)

    const projectContext: ProjectContext = {
      status: 'resolved',
      project: {
        id: 'proj_1',
        target: {
          host: 'localhost',
          port: 5432,
          database: 'db_1',
          user: 'u',
          password: 'p',
        },
      },
    }

    const dummySession = {} as unknown as Session
    const mockResource = {
      authSession: mock(() => dummySession),
      session: mock(() => dummySession),
    } as unknown as TenantResource

    const mockPool = {
      get: mock(() => Promise.resolve(mockResource)),
    } as unknown as TenantResourcePool

    const { auth } = await resolveTenantContext(headers, projectContext, mockPool, jwtSecret)

    expect(auth.type).toBe('jwt')
    expect(auth.userId).toBe('usr_bob')
    expect(auth.sessionId).toBe('sess_bob')
    expect(auth.roles).toEqual(['any', 'users', 'user:usr_bob'])
  })

  it('falls back to guest when no credentials provided for resolved project', async () => {
    const headers = new Headers()
    const projectContext: ProjectContext = {
      status: 'resolved',
      project: {
        id: 'proj_1',
        target: {
          host: 'localhost',
          port: 5432,
          database: 'db_1',
          user: 'u',
          password: 'p',
        },
      },
    }

    const dummySession = {} as unknown as Session
    const mockResource = {
      authSession: mock(() => dummySession),
      session: mock(() => dummySession),
    } as unknown as TenantResource

    const mockPool = {
      get: mock(() => Promise.resolve(mockResource)),
    } as unknown as TenantResourcePool

    const { tenant, auth } = await resolveTenantContext(headers, projectContext, mockPool)

    expect(auth.type).toBe('guest')
    expect(auth.roles).toEqual(['any', 'guests'])
    expect(tenant.roles).toEqual(['any', 'guests'])
  })
})
