import { beforeAll, describe, expect, it } from 'bun:test'
import { Doc, type IEntity } from '@nuvix/db'
import {
  deliverExternalMessage,
  type MessageSender,
  type MessagingDeps,
  setMessageSender,
} from './messaging.processor'

// biome-ignore lint/suspicious/noExplicitAny: dynamic tenant records
type AnyDoc = Doc<any>

/** In-memory tenant session stub covering the delivery surface. */
function stubSession(collections: Record<string, Array<Record<string, unknown>>>) {
  const store = new Map<string, Map<string, AnyDoc>>()
  for (const [name, docs] of Object.entries(collections)) {
    const col = new Map<string, AnyDoc>()
    for (const data of docs) {
      const doc = new Doc<Partial<IEntity> & Record<string, unknown>>(data)
      col.set(String(data.$id ?? doc.getId()), doc)
    }
    store.set(name, col)
  }

  const colOf = (name: string) => store.get(name) ?? new Map<string, AnyDoc>()

  return {
    store,
    async getDocument(collection: string, id: string) {
      return colOf(collection).get(id) ?? new Doc()
    },
    async findOne(collection: string, queries: Array<Record<string, unknown>>) {
      const all = [...colOf(collection).values()]
      for (const q of queries) {
        const attr = (q as { attribute?: string }).attribute
        const values = (q as { values?: unknown[] }).values
        if (attr && values) {
          return (
            all.find((d) => {
              const v = d.get(attr)
              return Array.isArray(v)
                ? values.every((x) => (v as unknown[]).includes(x))
                : values.includes(v)
            }) ?? new Doc()
          )
        }
      }
      return all[0] ?? new Doc()
    },
    async find(collection: string, queries: Array<Record<string, unknown>>) {
      let all = [...colOf(collection).values()]
      for (const q of queries) {
        const attr = (q as { attribute?: string }).attribute
        const values = (q as { values?: unknown[] }).values
        if (attr && values) {
          all = all.filter((d) => {
            const v = d.get(attr)
            return Array.isArray(v)
              ? values.every((x) => (v as unknown[]).includes(x))
              : values.includes(v)
          })
        }
      }
      return all
    },
    async updateDocument(_collection: string, _id: string, doc: AnyDoc): Promise<AnyDoc> {
      return doc
    },
    async createDocument(collection: string, doc: AnyDoc): Promise<AnyDoc> {
      colOf(collection).set(doc.getId(), doc)
      return doc
    },
    async deleteDocument(collection: string, id: string) {
      colOf(collection).delete(id)
    },
  }
}

function recordingSender(
  results: Array<{
    recipient: string
    status: 'success' | 'failure'
    error: string
  }> = [],
  deliveredPerBatch = 1,
) {
  const batches: Array<{
    messageType: string
    provider: string
    to: string[]
  }> = []
  const sender: MessageSender = {
    async batchLimit() {
      return 2 // small so chunking is exercised
    },
    async send(params) {
      batches.push({
        messageType: params.messageType,
        provider: params.provider.provider,
        to: params.payload.to,
      })
      return { deliveredTo: deliveredPerBatch, results }
    },
  }
  return { sender, batches }
}

function fixtureMessage(overrides: Record<string, unknown> = {}): AnyDoc {
  return new Doc<Partial<IEntity> & Record<string, unknown>>({
    $id: 'msg_1',
    providerType: 'email',
    topics: [],
    users: [],
    targets: ['t1', 't2', 't3'],
    status: 'processing',
    data: {
      subject: 'Hello',
      content: 'Body',
      html: false,
      cc: [],
      bcc: [],
      attachments: [],
    },
    deliveryErrors: [],
    search: 'msg_1',
    ...overrides,
  })
}

function fixtureProviders(): Record<string, Array<Record<string, unknown>>> {
  return {
    messages: [],
    providers: [
      {
        $id: 'prov_default',
        name: 'Mail SMTP',
        provider: 'smtp',
        type: 'email',
        enabled: true,
        credentials: { host: 'smtp.test', port: 587 },
        options: { fromEmail: 'no-reply@test', fromName: 'Test' },
      },
      {
        $id: 'prov_disabled',
        name: 'Dead SMTP',
        provider: 'smtp',
        type: 'email',
        enabled: false,
        credentials: {},
        options: {},
      },
    ],
    targets: [
      {
        $id: 't1',
        identifier: 'a@test',
        providerType: 'email',
        providerId: 'prov_disabled', // falls back to the default provider
      },
      { $id: 't2', identifier: 'b@test', providerType: 'email' },
      { $id: 't3', identifier: 'c@test', providerType: 'email' },
      { $id: 't4', identifier: 'X', providerType: 'push' }, // filtered out
    ],
    topics: [],
    users: [],
  }
}

describe('messaging delivery (v1 sendExternalMessage parity)', () => {
  let deps: MessagingDeps
  let providers: Record<string, Array<Record<string, unknown>>>

  beforeAll(() => {
    providers = fixtureProviders()
    deps = { session: stubSession(providers) as never }
  })

  it('delivers to direct targets through the default provider, chunked by batch limit', async () => {
    const { sender, batches } = recordingSender()
    setMessageSender(sender)

    const session = stubSession(providers)
    const message = fixtureMessage()
    const result = await deliverExternalMessage(message, {
      session: session as never,
    })

    // t1..t3 resolve (t4 is push-filtered); grouped per providerId —
    // t1 names a disabled provider so it falls back to the default, and
    // batchLimit 2 splits { a,b } / { c } within the default group.
    // [v1 groups per providerId: prov_disabled → fallback default]
    expect(batches).toHaveLength(2)
    const allRecipients = batches.flatMap((b) => b.to).sort()
    expect(allRecipients).toEqual(['a@test', 'b@test', 'c@test'])
    // boundary reports one delivery per batch
    expect(result.deliveredTotal).toBe(2)
    expect(result.status).toBe('sent')
    expect(message.get('status')).toBe('sent')
    expect(message.get('deliveredTotal')).toBe(2)
    expect(String(message.get('search'))).toContain('smtp')
  })

  it('records per-target failures and still sends (partial)', async () => {
    const { sender, batches } = recordingSender([
      { recipient: 'a@test', status: 'failure', error: 'bounce' },
    ])
    setMessageSender(sender)

    const session = stubSession(fixtureProviders())
    const message = fixtureMessage()
    const result = await deliverExternalMessage(message, {
      session: session as never,
    })

    expect(batches.length).toBe(2)
    expect(result.deliveredTotal).toBe(2)
    expect(result.status).toBe('sent') // errors but deliveredTotal > 0
    expect(message.get('deliveryErrors')).toContain(
      'Failed sending to target a@test with error: bounce',
    )
    expect(message.get('status')).toBe('sent')
  })

  it('fails the message when delivery errors leave zero deliveries', async () => {
    const { sender } = recordingSender([], 0)
    setMessageSender(sender)

    const session = stubSession(fixtureProviders())
    const message = fixtureMessage()
    const result = await deliverExternalMessage(message, {
      session: session as never,
    })
    expect(result.deliveredTotal).toBe(0)
    expect(result.status).toBe('failed')
    expect(message.get('status')).toBe('failed')
    expect(message.get('deliveryErrors')).toEqual(['Unknown error'])
  })

  it('marks the message failed when no valid recipients exist', async () => {
    const message = fixtureMessage({ targets: [], topics: [], users: [] })
    const session = stubSession(providers)
    const result = await deliverExternalMessage(message, {
      session: session as never,
    })
    expect(result.status).toBe('failed')
    expect(message.get('status')).toBe('failed')
    expect(message.get('deliveryErrors')).toEqual(['No valid recipients found.'])
  })

  it('marks the message failed when no enabled provider exists', async () => {
    const message = fixtureMessage()
    const empty = stubSession({
      messages: [],
      providers: [
        {
          $id: 'p',
          name: 'x',
          provider: 'smtp',
          type: 'email',
          enabled: false,
        },
      ],
      targets: [{ $id: 't1', identifier: 'a@test', providerType: 'email' }],
      topics: [],
      users: [],
    })
    const result = await deliverExternalMessage(message, {
      session: empty as never,
    })
    expect(result.status).toBe('failed')
    expect(message.get('deliveryErrors')).toEqual(['No enabled provider found.'])
  })

  it('is idempotent for already-sent messages', async () => {
    const message = fixtureMessage({ status: 'sent' })
    const result = await deliverExternalMessage(message, deps)
    expect(result.status).toBe('sent')
    expect(result.deliveredTotal).toBe(0)
  })
})
