import { describe, expect, it } from 'bun:test'
import { treaty } from '@elysia/eden'
import { Elysia } from 'elysia'
import { NotFoundError } from '../../shared/errors'
import type { MessagesService } from './messages.service'
import type { ProvidersService } from './providers.service'
import { messagingRoutes } from './routes'
import type { SubscribersService } from './subscribers.service'
import type { TopicsService } from './topics.service'
import type { MessageView, MessagingCallerAuth, ProviderView, TopicView } from './types'

// ---------- In-memory mock services ----------

const providersStore = new Map<string, ProviderView>()
const topicsStore = new Map<string, TopicView>()
const messagesStore = new Map<string, MessageView>()

const mockProviders: ProvidersService = {
  listProviders: () =>
    Promise.resolve({ providers: Array.from(providersStore.values()), total: providersStore.size }),
  getProvider: (id: string) => {
    const p = providersStore.get(id)
    if (!p)
      return Promise.reject(new NotFoundError('Provider not found', { code: 'provider_not_found' }))
    return Promise.resolve(p)
  },
  createMailgun: (input) => {
    const p: ProviderView = {
      $id: input.providerId ?? 'p_mg',
      name: input.name,
      provider: 'mailgun',
      type: 'email',
      enabled: input.enabled ?? true,
      options: { fromEmail: input.fromEmail },
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
    }
    providersStore.set(p.$id, p)
    return Promise.resolve(p)
  },
  createSendgrid: () => Promise.resolve({} as ProviderView),
  createSmtp: () => Promise.resolve({} as ProviderView),
  createTwilio: () => Promise.resolve({} as ProviderView),
  createVonage: () => Promise.resolve({} as ProviderView),
  createMsg91: () => Promise.resolve({} as ProviderView),
  createTelesign: () => Promise.resolve({} as ProviderView),
  createTextmagic: () => Promise.resolve({} as ProviderView),
  createFcm: () => Promise.resolve({} as ProviderView),
  createApns: () => Promise.resolve({} as ProviderView),
  updateMailgun: (id, input) => {
    const p = providersStore.get(id)
    if (!p) return Promise.reject(new NotFoundError('Not found', { code: 'provider_not_found' }))
    const updated = { ...p, name: input.name ?? p.name }
    providersStore.set(id, updated)
    return Promise.resolve(updated)
  },
  updateSendgrid: () => Promise.resolve({} as ProviderView),
  updateSmtp: () => Promise.resolve({} as ProviderView),
  updateTwilio: () => Promise.resolve({} as ProviderView),
  updateVonage: () => Promise.resolve({} as ProviderView),
  updateMsg91: () => Promise.resolve({} as ProviderView),
  updateTelesign: () => Promise.resolve({} as ProviderView),
  updateTextmagic: () => Promise.resolve({} as ProviderView),
  updateFcm: () => Promise.resolve({} as ProviderView),
  updateApns: () => Promise.resolve({} as ProviderView),
  deleteProvider: (id: string) => {
    providersStore.delete(id)
    return Promise.resolve()
  },
} as unknown as ProvidersService

const mockTopics: TopicsService = {
  listTopics: () =>
    Promise.resolve({ topics: Array.from(topicsStore.values()), total: topicsStore.size }),
  getTopic: (id: string) => {
    const t = topicsStore.get(id)
    if (!t) return Promise.reject(new NotFoundError('Topic not found', { code: 'topic_not_found' }))
    return Promise.resolve(t)
  },
  createTopic: (input) => {
    const t: TopicView = {
      $id: input.topicId ?? 'top_1',
      name: input.name,
      subscribe: input.subscribe ?? ['users'],
      emailTotal: 0,
      smsTotal: 0,
      pushTotal: 0,
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
    }
    topicsStore.set(t.$id, t)
    return Promise.resolve(t)
  },
  updateTopic: (id, input) => {
    const t = topicsStore.get(id)
    if (!t) return Promise.reject(new NotFoundError('Not found', { code: 'topic_not_found' }))
    const updated = { ...t, name: input.name ?? t.name }
    topicsStore.set(id, updated)
    return Promise.resolve(updated)
  },
  deleteTopic: (id: string) => {
    topicsStore.delete(id)
    return Promise.resolve()
  },
} as unknown as TopicsService

const mockSubscribers: SubscribersService = {
  createSubscriber: () => Promise.resolve({} as ReturnType<SubscribersService['createSubscriber']>),
  listSubscribers: () => Promise.resolve({ subscribers: [], total: 0 }),
  getSubscriber: () =>
    Promise.reject(new NotFoundError('Not found', { code: 'subscriber_not_found' })),
  deleteSubscriber: () => Promise.resolve(),
} as unknown as SubscribersService

const mockMessages: MessagesService = {
  listMessages: () =>
    Promise.resolve({ messages: Array.from(messagesStore.values()), total: messagesStore.size }),
  getMessage: (id: string) => {
    const m = messagesStore.get(id)
    if (!m) return Promise.reject(new NotFoundError('Not found', { code: 'message_not_found' }))
    return Promise.resolve(m)
  },
  createEmail: (input) => {
    const m: MessageView = {
      $id: input.messageId ?? 'msg_r1',
      providerType: 'email',
      status: input.draft ? 'draft' : 'processing',
      topics: input.topics ?? [],
      users: input.users ?? [],
      targets: input.targets ?? [],
      data: { subject: input.subject, content: input.content },
      scheduledAt: null,
      deliveredAt: null,
      deliveryErrors: [],
      deliveredTotal: 0,
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
    }
    messagesStore.set(m.$id, m)
    return Promise.resolve(m)
  },
  createSms: () => Promise.resolve({} as MessageView),
  createPush: () => Promise.resolve({} as MessageView),
  updateEmail: () => Promise.resolve({} as MessageView),
  updateSms: () => Promise.resolve({} as MessageView),
  updatePush: () => Promise.resolve({} as MessageView),
  deleteMessage: (id: string) => {
    messagesStore.delete(id)
    return Promise.resolve()
  },
} as unknown as MessagesService

// ---------- Test app ----------

const adminAuth: MessagingCallerAuth = { isAdmin: true, isKey: false, roles: ['admin'] }

const app = new Elysia({ prefix: '/v2' }).use(
  messagingRoutes({
    providers: mockProviders,
    topics: mockTopics,
    subscribers: mockSubscribers,
    messages: mockMessages,
    getCallerAuth: () => adminAuth,
  }),
)

const client = treaty(app).v2

// ---------- Provider routes ----------

describe('messaging/providers routes', () => {
  it('creates a Mailgun provider', async () => {
    const { data, error } = await client.messaging.providers.mailgun.post({
      providerId: 'p_r_mg',
      name: 'Route Mailgun',
      apiKey: 'k',
      domain: 'd.com',
      fromEmail: 'a@b.com',
    })
    expect(error).toBeNull()
    expect(data?.$id).toBe('p_r_mg')
    expect(data?.provider).toBe('mailgun')
  })

  it('lists providers', async () => {
    const { data, error } = await client.messaging.providers.get()
    expect(error).toBeNull()
    expect(Array.isArray(data?.data)).toBe(true)
  })

  it('gets a provider by id', async () => {
    const { data, error } = (await (client.messaging.providers as Record<string, unknown>)[
      'p_r_mg'
    ].get()) as Awaited<ReturnType<typeof client.messaging.providers.get>>
    expect(error).toBeNull()
    expect(data?.$id).toBe('p_r_mg')
  })

  it('returns 404 for missing provider', async () => {
    const res = (await (client.messaging.providers as Record<string, unknown>)[
      'missing_id'
    ].get()) as { error: { status: number } }
    expect(res.error?.status).toBe(404)
  })

  it('deletes a provider', async () => {
    const res = (await (client.messaging.providers as Record<string, unknown>)[
      'p_r_mg'
    ].delete()) as { status: number }
    expect(res.status ?? 204).toBe(204)
  })
})

// ---------- Topic routes ----------

describe('messaging/topics routes', () => {
  it('creates a topic', async () => {
    const { data, error } = await client.messaging.topics.post({
      topicId: 'top_r1',
      name: 'Alerts',
      subscribe: ['users'],
    })
    expect(error).toBeNull()
    expect(data?.$id).toBe('top_r1')
    expect(data?.name).toBe('Alerts')
  })

  it('lists topics', async () => {
    const { data, error } = await client.messaging.topics.get()
    expect(error).toBeNull()
    expect(Array.isArray(data?.data)).toBe(true)
  })
})

// ---------- Message routes ----------

describe('messaging/messages routes', () => {
  it('creates an email message', async () => {
    const { data, error } = await client.messaging.messages.email.post({
      messageId: 'msg_r1',
      subject: 'Hello',
      content: 'World',
      users: ['u_1'],
      draft: false,
    })
    expect(error).toBeNull()
    expect(data?.$id).toBe('msg_r1')
    expect(data?.providerType).toBe('email')
  })

  it('lists messages', async () => {
    const { data, error } = await client.messaging.messages.get()
    expect(error).toBeNull()
    expect(Array.isArray(data?.data)).toBe(true)
  })
})
