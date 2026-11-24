/** Route tests for admin user management, identities, and activity logs. */
import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import { Translator } from '@nuvix/i18n'
import { Elysia } from 'elysia'
import { problemErrors } from '../plugins/errors'
import { userRoutes } from './route'

interface UserResponse {
  $id: string
  email?: string
  name?: string
  password?: string
  targets: Array<{ identifier: string }>
}

interface UserListResponse {
  total: number
  users: Array<{ $id: string }>
}

interface SessionResponse {
  $id: string
  userId: string
}

interface SessionListResponse {
  total: number
  sessions: Array<{ $id: string }>
}

interface TargetResponse {
  $id: string
  providerType: string
  identifier: string
}

describe('Users Routes', () => {
  const usersMap = new Map<string, Doc>()
  const targetsMap = new Map<string, Doc>()
  const sessionsMap = new Map<string, Doc>()
  const identitiesMap = new Map<string, Doc>()
  const auditMap = new Map<string, Doc>()

  const mockSession = {
    find: async (collection: string, _queries: unknown[] = []) => {
      if (collection === 'users') return [...usersMap.values()]
      if (collection === 'targets') return [...targetsMap.values()]
      if (collection === 'sessions') return [...sessionsMap.values()]
      if (collection === 'identities') return [...identitiesMap.values()]
      if (collection === 'audit') return [...auditMap.values()].reverse()
      return []
    },
    findOne: async (collection: string, queries: Array<{ values?: string[] }> = []) => {
      if (collection === 'users') {
        const q = queries[0]
        if (q?.values?.[0]) {
          for (const u of usersMap.values()) {
            if (u.get('email') === q.values[0] || u.get('phone') === q.values[0]) {
              return u
            }
          }
        }
      }
      return new Doc({})
    },
    getDocument: async (collection: string, id: string) => {
      if (collection === 'users') return usersMap.get(id) ?? new Doc({})
      if (collection === 'targets') return targetsMap.get(id) ?? new Doc({})
      if (collection === 'sessions') return sessionsMap.get(id) ?? new Doc({})
      if (collection === 'identities') return identitiesMap.get(id) ?? new Doc({})
      if (collection === 'audit') return auditMap.get(id) ?? new Doc({})
      return new Doc({})
    },
    createDocument: async (collection: string, doc: Doc) => {
      if (collection === 'users' && doc.get('$sequence') === undefined)
        doc.set('$sequence', usersMap.size + 1)
      if (collection === 'users') usersMap.set(doc.getId(), doc)
      if (collection === 'targets') targetsMap.set(doc.getId(), doc)
      if (collection === 'sessions') sessionsMap.set(doc.getId(), doc)
      if (collection === 'identities') identitiesMap.set(doc.getId(), doc)
      if (collection === 'audit') auditMap.set(doc.getId(), doc)
      return doc
    },
    updateDocument: async (collection: string, id: string, doc: Doc) => {
      if (collection === 'users') usersMap.set(id, doc)
      if (collection === 'targets') targetsMap.set(id, doc)
      if (collection === 'sessions') sessionsMap.set(id, doc)
      return doc
    },
    deleteDocument: async (collection: string, id: string) => {
      if (collection === 'users') usersMap.delete(id)
      if (collection === 'targets') targetsMap.delete(id)
      if (collection === 'sessions') sessionsMap.delete(id)
      if (collection === 'identities') identitiesMap.delete(id)
      return true
    },
    count: async (collection: string) => {
      if (collection === 'users') return usersMap.size
      if (collection === 'targets') return targetsMap.size
      if (collection === 'sessions') return sessionsMap.size
      if (collection === 'identities') return identitiesMap.size
      if (collection === 'audit') return auditMap.size
      return 0
    },
  } as unknown as Session

  const testApp = new Elysia()
    .use(
      problemErrors({
        getTranslator: async () => new Translator('en', 'en', { primary: {}, fallback: {} }),
      }),
    )
    .derive('plugin', () => ({ db: mockSession }))
    .use(userRoutes({ jwtSecret: 'test-secret' }))

  it('creates a user via POST /users', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: 'user_test_1',
          email: 'alice@example.com',
          password: 'password123',
          name: 'Alice Smith',
        }),
      }),
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as UserResponse
    expect(data.$id).toBe('user_test_1')
    expect(data.email).toBe('alice@example.com')
    expect(data.name).toBe('Alice Smith')
    expect(data.password).toBeUndefined() // sensitive field excluded
    expect(data.targets.length).toBe(1)
    expect(data.targets[0]?.identifier).toBe('alice@example.com')
  })

  it('retrieves a user via GET /users/:userId', async () => {
    const res = await testApp.handle(new Request('http://localhost/users/user_test_1'))

    expect(res.status).toBe(200)
    const data = (await res.json()) as UserResponse
    expect(data.$id).toBe('user_test_1')
    expect(data.email).toBe('alice@example.com')
  })

  it('updates a user name via PATCH /users/:userId/name', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/users/user_test_1/name', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Alice Cooper' }),
      }),
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as UserResponse
    expect(data.name).toBe('Alice Cooper')
  })

  it('lists users via GET /users', async () => {
    const res = await testApp.handle(new Request('http://localhost/users'))

    expect(res.status).toBe(200)
    const data = (await res.json()) as UserListResponse
    expect(data.total).toBe(1)
    expect(data.users.length).toBe(1)
    expect(data.users[0]?.$id).toBe('user_test_1')
  })

  it('creates and lists user sessions', async () => {
    const createRes = await testApp.handle(
      new Request('http://localhost/users/user_test_1/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'email' }),
      }),
    )
    expect(createRes.status).toBe(200)
    const session = (await createRes.json()) as SessionResponse
    expect(session.userId).toBe('user_test_1')

    const listRes = await testApp.handle(new Request('http://localhost/users/user_test_1/sessions'))
    expect(listRes.status).toBe(200)
    const listData = (await listRes.json()) as SessionListResponse
    expect(listData.total).toBe(1)
  })

  it('creates and gets user targets', async () => {
    const createRes = await testApp.handle(
      new Request('http://localhost/users/user_test_1/targets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerType: 'sms',
          identifier: '+1234567890',
          name: 'My Phone',
        }),
      }),
    )
    expect(createRes.status).toBe(200)
    const target = (await createRes.json()) as TargetResponse
    expect(target.providerType).toBe('sms')
    expect(target.identifier).toBe('+1234567890')

    const getRes = await testApp.handle(
      new Request(`http://localhost/users/user_test_1/targets/${target.$id}`),
    )
    expect(getRes.status).toBe(200)
    const fetched = (await getRes.json()) as TargetResponse
    expect(fetched.identifier).toBe('+1234567890')
  })

  it('deletes a user via DELETE /users/:userId', async () => {
    const delRes = await testApp.handle(
      new Request('http://localhost/users/user_test_1', {
        method: 'DELETE',
      }),
    )
    expect(delRes.status).toBe(200)

    const getRes = await testApp.handle(new Request('http://localhost/users/user_test_1'))
    expect(getRes.status).toBe(404)
  })

  it('lists user activity logs via GET /users/:userId/logs', async () => {
    await mockSession.createDocument(
      'users',
      new Doc({ $id: 'user_logs_1', email: 'logs@example.com' }),
    )
    await mockSession.createDocument(
      'audit',
      new Doc({
        $id: 'log_1',
        userId: 5,
        event: 'session.create',
        resource: 'user/user_logs_1',
        userAgent: 'Mozilla/5.0 (Macintosh) Chrome/128.0',
        ip: '203.0.113.4',
        time: new Date().toISOString(),
        data: { userId: 'user_logs_1', userEmail: 'logs@example.com', userName: 'Logger' },
      }),
    )

    const res = await testApp.handle(new Request('http://localhost/users/user_logs_1/logs'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      total: number
      logs: Array<{
        event: string
        osName: string
        clientName: string
        countryName: string
      }>
    }
    expect(data.total).toBe(1)
    expect(data.logs[0]!.event).toBe('session.create')
    // UA detection applied (Detector on the stored user-agent)
    expect(data.logs[0]!.osName).toBe('macOS')
    expect(data.logs[0]!.clientName).toBe('Chrome')
    // No geoip provider wired in tests → country degrades gracefully
    expect(data.logs[0]!.countryName).toBe('Unknown')
  })

  it('returns 404 user_not_found for logs of an unknown user', async () => {
    const res = await testApp.handle(new Request('http://localhost/users/user_missing/logs'))
    expect(res.status).toBe(404)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('user_not_found')
  })

  it('returns user usage statistics via GET /users/usage', async () => {
    const res = await testApp.handle(new Request('http://localhost/users/usage?range=30d'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { range: string; usersTotal: number }
    expect(data.range).toBe('30d')
    expect(data.usersTotal).toBeDefined()
  })

  it('lists project identities via GET /users/identities', async () => {
    await mockSession.createDocument(
      'identities',
      new Doc({
        $id: 'identity_1',
        userId: 'user_x',
        provider: 'google',
        providerUid: 'g-1',
        providerEmail: 'g@example.com',
      }),
    )

    const res = await testApp.handle(new Request('http://localhost/users/identities'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      total: number
      identities: Array<{ $id: string; provider: string }>
    }
    expect(data.total).toBe(1)
    expect(data.identities[0]!.$id).toBe('identity_1')
    expect(data.identities[0]!.provider).toBe('google')
  })

  it('deletes an identity via DELETE /users/identities/:identityId', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/users/identities/identity_1', {
        method: 'DELETE',
      }),
    )
    expect(res.status).toBe(200)
    expect(identitiesMap.has('identity_1')).toBe(false)

    const missing = await testApp.handle(
      new Request('http://localhost/users/identities/identity_1', {
        method: 'DELETE',
      }),
    )
    expect(missing.status).toBe(404)
    const body = (await missing.json()) as { code?: string }
    expect(body.code).toBe('user_identity_not_found')
  })
})
