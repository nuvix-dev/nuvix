import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../shared/errors'
import { MessagesService } from './messages.service'
import { ProvidersService } from './providers.service'
import { TopicsService } from './topics.service'

// ---------- Fake session ----------

type FakeStore = Map<string, Doc<Record<string, unknown>>>

function makeMockSession(stores: Record<string, FakeStore>): Session {
  return {
    find: (col: string) => Promise.resolve(Array.from(stores[col]?.values() ?? [])),
    count: (col: string) => Promise.resolve(stores[col]?.size ?? 0),
    getDocument: (col: string, id: string) => {
      const doc = stores[col]?.get(id)
      return Promise.resolve(doc ?? new Doc({}))
    },
    createDocument: (col: string, doc: Doc<Record<string, unknown>>) => {
      const store = stores[col]
      if (store?.has(doc.getId())) {
        return Promise.reject(new Error('duplicate key'))
      }
      store?.set(doc.getId(), doc)
      return Promise.resolve(doc)
    },
    updateDocument: (col: string, id: string, doc: Doc<Record<string, unknown>>) => {
      stores[col]?.set(id, doc)
      return Promise.resolve(doc)
    },
    deleteDocument: (col: string, id: string) => {
      stores[col]?.delete(id)
      return Promise.resolve(true)
    },
    increaseDocumentAttribute: (col: string, id: string, attr: string) => {
      const doc = stores[col]?.get(id)
      if (doc) {
        const cur = Number(doc.get(attr) ?? 0)
        doc.set(attr, cur + 1)
      }
      return Promise.resolve(doc ?? new Doc({}))
    },
    decreaseDocumentAttribute: (col: string, id: string, attr: string) => {
      const doc = stores[col]?.get(id)
      if (doc) {
        const cur = Number(doc.get(attr) ?? 0)
        doc.set(attr, Math.max(0, cur - 1))
      }
      return Promise.resolve(doc ?? new Doc({}))
    },
  } as unknown as Session
}

// ---------- ProvidersService ----------

describe('ProvidersService', () => {
  const stores: Record<string, FakeStore> = { providers: new Map() }
  const session = makeMockSession(stores)
  const svc = new ProvidersService(session)

  it('creates a Mailgun provider', async () => {
    const p = await svc.createMailgun({
      providerId: 'p_mg',
      name: 'My Mailgun',
      apiKey: 'key-abc',
      domain: 'mg.example.com',
      fromEmail: 'no-reply@example.com',
    })
    expect(p.$id).toBe('p_mg')
    expect(p.provider).toBe('mailgun')
    expect(p.type).toBe('email')
    expect(p.enabled).toBe(true)
    expect((p.options as Record<string, unknown>).fromEmail).toBe('no-reply@example.com')
    // Credentials MUST NOT leak into the view
    expect((p as unknown as Record<string, unknown>).credentials).toBeUndefined()
  })

  it('creates a Twilio SMS provider', async () => {
    const p = await svc.createTwilio({
      providerId: 'p_tw',
      name: 'Twilio',
      accountSid: 'ACxxx',
      authToken: 'tok',
      from: '+15550000000',
    })
    expect(p.type).toBe('sms')
    expect(p.provider).toBe('twilio')
  })

  it('creates an FCM push provider', async () => {
    const p = await svc.createFcm({
      providerId: 'p_fcm',
      name: 'Firebase',
      serviceAccount: JSON.stringify({ project_id: 'my-project' }),
    })
    expect(p.type).toBe('push')
    expect(p.provider).toBe('fcm')
  })

  it('lists providers', async () => {
    const { providers, total } = await svc.listProviders({})
    expect(providers.length).toBeGreaterThanOrEqual(3)
    expect(total).toBeGreaterThanOrEqual(3)
  })

  it('gets provider by id', async () => {
    const p = await svc.getProvider('p_mg')
    expect(p.$id).toBe('p_mg')
  })

  it('throws NotFoundError for missing provider', async () => {
    await expect(svc.getProvider('nope')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('rejects duplicate provider id', async () => {
    await expect(
      svc.createMailgun({
        providerId: 'p_mg',
        name: 'Dup',
        apiKey: 'key-2',
        domain: 'x.com',
      }),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('updates a provider', async () => {
    const updated = await svc.updateMailgun('p_mg', { fromEmail: 'new@example.com' })
    expect((updated.options as Record<string, unknown>).fromEmail).toBe('new@example.com')
  })

  it('deletes a provider', async () => {
    await svc.deleteProvider('p_mg')
    await expect(svc.getProvider('p_mg')).rejects.toBeInstanceOf(NotFoundError)
  })
})

// ---------- TopicsService ----------

describe('TopicsService', () => {
  const stores: Record<string, FakeStore> = { topics: new Map() }
  const session = makeMockSession(stores)
  const svc = new TopicsService(session)

  it('creates a topic', async () => {
    const t = await svc.createTopic({
      topicId: 'top_1',
      name: 'Announcements',
      subscribe: ['users'],
    })
    expect(t.$id).toBe('top_1')
    expect(t.name).toBe('Announcements')
    expect(t.emailTotal).toBe(0)
  })

  it('rejects duplicate topic', async () => {
    await expect(svc.createTopic({ topicId: 'top_1', name: 'Dup' })).rejects.toBeInstanceOf(
      ConflictError,
    )
  })

  it('gets a topic', async () => {
    const t = await svc.getTopic('top_1')
    expect(t.name).toBe('Announcements')
  })

  it('throws NotFoundError for missing topic', async () => {
    await expect(svc.getTopic('nope')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('updates a topic', async () => {
    const updated = await svc.updateTopic('top_1', { name: 'News' })
    expect(updated.name).toBe('News')
  })

  it('deletes a topic', async () => {
    await svc.deleteTopic('top_1')
    await expect(svc.getTopic('top_1')).rejects.toBeInstanceOf(NotFoundError)
  })
})

// ---------- MessagesService ----------

describe('MessagesService', () => {
  const stores: Record<string, FakeStore> = { messages: new Map() }
  const session = makeMockSession(stores)
  const svc = new MessagesService(session)

  it('creates an email draft', async () => {
    const m = await svc.createEmail({
      messageId: 'msg_1',
      subject: 'Hello',
      content: '<p>World</p>',
      draft: true,
    })
    expect(m.$id).toBe('msg_1')
    expect(m.status).toBe('draft')
    expect(m.providerType).toBe('email')
    expect((m.data as Record<string, unknown>).subject).toBe('Hello')
  })

  it('creates an SMS in processing status when targeting users', async () => {
    const m = await svc.createSms({
      messageId: 'msg_2',
      content: 'ping',
      users: ['u_abc'],
    })
    expect(m.status).toBe('processing')
  })

  it('creates a push notification as scheduled', async () => {
    const m = await svc.createPush({
      messageId: 'msg_3',
      title: 'Heads up',
      body: 'Something happened',
      users: ['u_abc'],
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    expect(m.status).toBe('scheduled')
    expect(m.scheduledAt).not.toBeNull()
  })

  it('rejects non-draft message with no targets', async () => {
    const { BadRequestError } = await import('../../shared/errors')
    await expect(
      svc.createEmail({
        subject: 'X',
        content: 'Y',
        draft: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestError)
  })

  it('prevents updating a processing message', async () => {
    const { BadRequestError } = await import('../../shared/errors')
    await expect(svc.updateEmail('msg_2', { subject: 'New subject' })).rejects.toBeInstanceOf(
      BadRequestError,
    )
  })

  it('updates draft message', async () => {
    const updated = await svc.updateEmail('msg_1', { subject: 'Updated' })
    expect((updated.data as Record<string, unknown>).subject).toBe('Updated')
  })

  it('lists messages', async () => {
    const { messages, total } = await svc.listMessages({})
    expect(total).toBeGreaterThanOrEqual(3)
    expect(messages.length).toBeGreaterThanOrEqual(3)
  })

  it('gets a message', async () => {
    const m = await svc.getMessage('msg_1')
    expect(m.$id).toBe('msg_1')
  })

  it('throws NotFoundError for missing message', async () => {
    await expect(svc.getMessage('nope')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('deletes a message', async () => {
    await svc.deleteMessage('msg_1')
    await expect(svc.getMessage('msg_1')).rejects.toBeInstanceOf(NotFoundError)
  })
})
