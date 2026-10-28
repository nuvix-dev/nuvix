/** Route-level audit coverage for account creation and deletion actor/resource attribution. */
import { beforeEach, describe, expect, it } from 'bun:test'
import type { ProjectRegistry } from '@nuvix/core/platform'
import { Doc, type Session } from '@nuvix/db'
import { Translator } from '@nuvix/i18n'
import { Elysia } from 'elysia'
import { initInMemoryAuditEmitter } from '../plugins/audit'
import { problemErrors } from '../plugins/errors'
import { accountRoutes } from './route'

// Use a small in-memory session so the tests observe emitted audit events without external services.

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
  find: async (c: string) => [...getCollection(c).values()],
  findOne: async () => new Doc({}),
  getDocument: async (c: string, id: string) => getCollection(c).get(id) ?? new Doc({}),
  createDocument: async (c: string, doc: Doc) => {
    doc.set('$sequence', getCollection(c).size + 1)
    getCollection(c).set(doc.getId(), doc)
    return doc
  },
  updateDocument: async (c: string, id: string, doc: Doc) => {
    getCollection(c).set(id, doc)
    return doc
  },
  deleteDocument: async (c: string, id: string) => {
    getCollection(c).delete(id)
    return true
  },
  count: async (c: string) => getCollection(c).size,
  purgeCachedDocument: async () => {},
} as unknown as Session

const fakeRegistry = {
  getOAuthProviders: async () => [],
  getPlatforms: async () => [{ type: 'web', hostname: 'app.example.com', key: null }],
  getAuthSettings: async () => ({}),
} as unknown as ProjectRegistry

const { events } = initInMemoryAuditEmitter()

const testApp = new Elysia()
  .use(
    problemErrors({
      getTranslator: async () => new Translator('en', 'en', { primary: {}, fallback: {} }),
    }),
  )
  .derive('plugin', ({ request }) => {
    const userId = request.headers.get('x-nuvix-test-user')
    return {
      db: mockSession,
      user: (userId && getCollection('users').get(userId)) || new Doc({}),
      session: new Doc({}),
      project: { id: 'proj_1' },
    }
  })
  .use(accountRoutes({ oauth2: { registry: fakeRegistry } }))

describe('audit emission through routes', () => {
  beforeEach(() => {
    events.length = 0
  })

  it('emits user.create with the mapped resource on POST /account', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/account', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (test)',
        },
        body: JSON.stringify({
          userId: 'audit_user_1',
          email: 'audit@example.com',
          password: 'SecurePass123!',
        }),
      }),
    )
    expect(res.status).toBe(200)
    const created = (await res.json()) as { $id: string }

    await new Promise((r) => setTimeout(r, 0))
    const event = events.find((e) => e.event === 'user.create')
    expect(event).toBeDefined()
    expect(event!.resource).toBe(`user/${created.$id}`)
    // A guest create has no actor; the created user is identified by resource and payload instead.
    expect(event!.userId).toBeUndefined()
    expect(event!.userAgent).toBe('Mozilla/5.0 (test)')
    // Credentials must never be copied into audit data.
    expect(JSON.stringify(event!.data)).not.toContain('SecurePass123!')
  })

  it('emits user.delete on DELETE /account (acting user source)', async () => {
    const user = await mockSession.createDocument(
      'users',
      new Doc({ $id: 'user_del_1', email: 'del@example.com', status: true }),
    )

    const res = await testApp.handle(
      new Request('http://localhost/account', {
        method: 'DELETE',
        headers: { 'x-nuvix-test-user': user.getId() },
      }),
    )
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 0))
    const event = events.find((e) => e.event === 'user.delete')
    expect(event).toBeDefined()
    expect(event!.resource).toBe('user/user_del_1')
    expect(event!.userId).toBe('user_del_1')
  })
})
