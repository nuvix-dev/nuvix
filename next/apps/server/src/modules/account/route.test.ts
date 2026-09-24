import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import { Translator } from '@nuvix/i18n'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import type { AccountView, SessionView, TargetView } from './formatter'
import { accountRoutes } from './route'

describe('Account Routes', () => {
  const store = new Map<string, Map<string, Doc>>()

  const getCollection = (name: string) => {
    let col = store.get(name)
    if (!col) {
      col = new Map()
      store.set(name, col)
    }
    return col
  }

  const mockSession = {
    find: async (collection: string, queries: Array<{ values?: unknown[] }> = []) => {
      const col = getCollection(collection)
      const all = [...col.values()]
      if (queries.length === 0) return all
      return all.filter((doc) => {
        for (const q of queries) {
          if (q.values && q.values.length > 0) {
            const val = q.values[0]
            const match =
              doc.get('userId') === val ||
              doc.get('type') === val ||
              doc.get('providerType') === val ||
              doc.get('email') === val ||
              doc.get('verified') === val
            if (!match) return false
          }
        }
        return true
      })
    },
    findOne: async (collection: string, queries: Array<{ values?: unknown[] }> = []) => {
      const col = getCollection(collection)
      for (const doc of col.values()) {
        for (const q of queries) {
          if (q.values && q.values.length > 0) {
            const val = q.values[0]
            if (
              doc.get('email') === val ||
              doc.get('phone') === val ||
              doc.get('providerEmail') === val ||
              doc.get('userId') === val
            ) {
              return doc
            }
          }
        }
      }
      return new Doc({})
    },
    getDocument: async (collection: string, id: string) => {
      const col = getCollection(collection)
      return col.get(id) ?? new Doc({})
    },
    createDocument: async (collection: string, doc: Doc) => {
      const col = getCollection(collection)
      col.set(doc.getId(), doc)
      return doc
    },
    updateDocument: async (collection: string, id: string, doc: Doc) => {
      const col = getCollection(collection)
      col.set(id, doc)
      return doc
    },
    deleteDocument: async (collection: string, id: string) => {
      const col = getCollection(collection)
      col.delete(id)
      return true
    },
    count: async (collection: string) => {
      return getCollection(collection).size
    },
  } as unknown as Session

  let currentUserDoc = new Doc({})
  let currentSessionDoc = new Doc({})

  const testApp = new Elysia()
    .use(
      problemErrors({
        getTranslator: async () => new Translator('en', 'en', { primary: {}, fallback: {} }),
      }),
    )
    .derive('plugin', () => ({
      db: mockSession,
      user: currentUserDoc,
      session: currentSessionDoc,
    }))
    .use(accountRoutes({ jwtSecret: 'test-secret' }))

  it('creates an account via POST /account', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/account', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: 'test_user_1',
          email: 'test_user@example.com',
          password: 'SecurePass123!',
          name: 'Test Account',
        }),
      }),
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as AccountView
    expect(data.email).toBe('test_user@example.com')
    expect(data.name).toBe('Test Account')
  })

  it('retrieves account via GET /account', async () => {
    currentUserDoc = (await mockSession.getDocument('users', 'test_user_1')) as Doc

    const res = await testApp.handle(new Request('http://localhost/account'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as AccountView
    expect(data.email).toBe('test_user@example.com')
  })

  it('updates preferences via PATCH /account/prefs', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/account/prefs', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prefs: { mode: 'dark', notifications: true },
        }),
      }),
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, unknown>
    expect(data.mode).toBe('dark')
  })

  it('updates name via PATCH /account/name', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/account/name', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      }),
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as AccountView
    expect(data.name).toBe('Updated Name')
  })

  it('creates an email session via POST /account/sessions/email', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/account/sessions/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'test_user@example.com',
          password: 'SecurePass123!',
        }),
      }),
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as SessionView
    expect(data.userId).toBe('test_user_1')
    expect(data.provider).toBe('email')

    currentSessionDoc = (await mockSession.getDocument('sessions', data.$id)) as Doc
  })

  it('lists sessions via GET /account/sessions', async () => {
    const res = await testApp.handle(new Request('http://localhost/account/sessions'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { total: number; sessions: SessionView[] }
    expect(data.total).toBeGreaterThanOrEqual(1)
  })

  it('creates and deletes a push target via /account/targets/push', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/account/targets/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          identifier: 'fcm-push-token-xyz',
          name: 'Chrome Browser',
        }),
      }),
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as TargetView
    expect(data.identifier).toBe('fcm-push-token-xyz')

    const delRes = await testApp.handle(
      new Request(`http://localhost/account/targets/${data.$id}/push`, {
        method: 'DELETE',
      }),
    )
    expect(delRes.status).toBe(200)
  })
})
