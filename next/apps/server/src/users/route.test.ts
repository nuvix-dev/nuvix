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

  const mockSession = {
    find: async (collection: string, _queries: unknown[] = []) => {
      if (collection === 'users') return [...usersMap.values()]
      if (collection === 'targets') return [...targetsMap.values()]
      if (collection === 'sessions') return [...sessionsMap.values()]
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
      return new Doc({})
    },
    createDocument: async (collection: string, doc: Doc) => {
      if (collection === 'users') usersMap.set(doc.getId(), doc)
      if (collection === 'targets') targetsMap.set(doc.getId(), doc)
      if (collection === 'sessions') sessionsMap.set(doc.getId(), doc)
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
      return true
    },
    count: async (collection: string) => {
      if (collection === 'users') return usersMap.size
      if (collection === 'targets') return targetsMap.size
      if (collection === 'sessions') return sessionsMap.size
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

  it('returns user usage statistics via GET /users/usage', async () => {
    const res = await testApp.handle(new Request('http://localhost/users/usage?range=30d'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { range: string; usersTotal: number }
    expect(data.range).toBe('30d')
    expect(data.usersTotal).toBeDefined()
  })
})
