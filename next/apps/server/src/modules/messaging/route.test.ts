import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import { Translator } from '@nuvix/i18n'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import type { MessageView, ProviderView, SubscriberView, TopicView } from './formatter'
import { messagingRoutes } from './route'

describe('Messaging Routes', () => {
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
    ctx: { roles: ['role:all', 'user:user_1', 'role:admin'] },
    find: async (collection: string, queries: Array<{ values?: unknown[] }> = []) => {
      const col = getCollection(collection)
      const all = [...col.values()]
      if (queries.length === 0) return all
      return all.filter((doc) => {
        for (const q of queries) {
          if (q.values && q.values.length > 0) {
            const val = q.values[0]
            const match =
              doc.get('topicId') === val ||
              doc.get('targetId') === val ||
              doc.get('userId') === val ||
              doc.get('name') === val ||
              doc.getId() === val ||
              (Array.isArray(val) && val.includes(doc.getId()))
            if (!match) return false
          }
        }
        return true
      })
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

  const currentUser = new Doc({
    $id: 'user_1',
    name: 'Messaging User',
    email: 'messaging@example.com',
  })

  const testApp = new Elysia()
    .use(
      problemErrors({
        getTranslator: async () => new Translator('en', 'en', { primary: {}, fallback: {} }),
      }),
    )
    .derive('plugin', () => ({
      db: mockSession,
      user: currentUser,
      isAPIUser: true,
      isAdmin: true,
    }))
    .use(messagingRoutes())

  it('creates a topic via POST /messaging/topics', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/messaging/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: 'general',
          name: 'General Announcements',
          subscribe: ['role:all'],
        }),
      }),
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as TopicView
    expect(json.$id).toBe('general')
    expect(json.name).toBe('General Announcements')
  })

  it('lists topics via GET /messaging/topics', async () => {
    const res = await testApp.handle(new Request('http://localhost/messaging/topics'))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { total: number; topics: TopicView[] }
    expect(json.total).toBeGreaterThanOrEqual(1)
    expect(json.topics[0]?.name).toBe('General Announcements')
  })

  it('creates a subscriber via POST /messaging/topics/:topicId/subscribers', async () => {
    // Seed user and target
    await mockSession.createDocument(
      'users',
      new Doc({ $id: 'user_1', name: 'Alice', email: 'alice@test.com' }),
    )
    await mockSession.createDocument(
      'targets',
      new Doc({
        $id: 'target_1',
        userId: 'user_1',
        providerType: 'email',
        identifier: 'alice@test.com',
      }),
    )

    const res = await testApp.handle(
      new Request('http://localhost/messaging/topics/general/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriberId: 'sub_general_1',
          targetId: 'target_1',
        }),
      }),
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as SubscriberView
    expect(json.$id).toBe('sub_general_1')
    expect(json.targetId).toBe('target_1')
  })

  it('creates a provider via POST /messaging/providers/mailgun', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/messaging/providers/mailgun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: 'mg_1',
          name: 'Mailgun Prod',
          apiKey: 'key-12345',
          domain: 'mail.nuvix.in',
          fromEmail: 'noreply@nuvix.in',
        }),
      }),
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as ProviderView
    expect(json.$id).toBe('mg_1')
    expect(json.name).toBe('Mailgun Prod')
    expect(json.provider).toBe('mailgun')
  })

  it('creates an email message via POST /messaging/messages/email', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/messaging/messages/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'email_msg_1',
          subject: 'System Maintenance',
          content: 'We will be down for 5 minutes',
          topics: ['general'],
        }),
      }),
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as MessageView
    expect(json.$id).toBe('email_msg_1')
    expect(json.providerType).toBe('email')
    expect(json.status).toBe('processing')
  })

  it('lists messages via GET /messaging/messages', async () => {
    const res = await testApp.handle(new Request('http://localhost/messaging/messages'))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { total: number; messages: MessageView[] }
    expect(json.total).toBeGreaterThanOrEqual(1)
  })

  it('deletes a message via DELETE /messaging/messages/:messageId', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/messaging/messages/email_msg_1', {
        method: 'DELETE',
      }),
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { status: string }
    expect(json.status).toBe('ok')
  })
})
