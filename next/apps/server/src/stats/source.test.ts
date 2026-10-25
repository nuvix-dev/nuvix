import { describe, expect, it } from 'bun:test'
import { Doc } from '@nuvix/db'
import { MetricFor } from '@nuvix/utils'
import { Elysia } from 'elysia'
import { statsRequestSource, wireStatsDatabase } from './source'

/** Records `on` registrations and lets tests trigger listeners directly. */
function stubDatabase() {
  const listeners = new Map<string, Array<(doc: unknown) => void>>()
  const database = {
    on: (event: string, _name: string, listener: (doc: unknown) => void) => {
      const list = listeners.get(event) ?? []
      list.push(listener)
      listeners.set(event, list)
      return database
    },
  }
  return { database: database as never, listeners }
}

function fakeDoc(collection: string, attrs: Record<string, unknown> = {}) {
  const doc = new Doc({ $collection: collection, ...attrs })
  return doc
}

describe('wireStatsDatabase (v1 StatsHelper parity)', () => {
  it('maps document creates/deletes to metric batches', async () => {
    const enqueued: Array<{
      projectId: string
      metrics: Array<{ key: string; value: number }>
    }> = []
    const { database, listeners } = stubDatabase()

    wireStatsDatabase({
      projectId: 'proj_1',
      database,
      enqueue: async (projectId, metrics) => {
        enqueued.push({ projectId, metrics })
      },
    })

    // Registered all four document-event listeners.
    expect(listeners.has('document_create')).toBe(true)
    expect(listeners.has('document_delete')).toBe(true)
    expect(listeners.has('documents_create')).toBe(true)
    expect(listeners.has('documents_delete')).toBe(true)

    const create = listeners.get('document_create')![0]!
    const remove = listeners.get('document_delete')![0]!
    const batchCreate = listeners.get('documents_create')![0]!

    create(fakeDoc('users'))
    remove(fakeDoc('sessions'))
    create(fakeDoc('teams'))
    create(fakeDoc('buckets'))
    create(fakeDoc('files', { sizeOriginal: 1024 }))
    remove(fakeDoc('files', { sizeOriginal: 512 }))
    create(fakeDoc('stats')) // unmatched collection → no metrics

    // Files carrying a bucketInternalId also record per-bucket metrics
    // (v1 `{bucketInternalId}.files[.storage]` key parity).
    create(fakeDoc('files', { sizeOriginal: 2048, bucketInternalId: 9 }))

    expect(enqueued).toEqual([
      { projectId: 'proj_1', metrics: [{ key: MetricFor.USERS, value: 1 }] },
      {
        projectId: 'proj_1',
        metrics: [{ key: MetricFor.SESSIONS, value: -1 }],
      },
      { projectId: 'proj_1', metrics: [{ key: MetricFor.TEAMS, value: 1 }] },
      { projectId: 'proj_1', metrics: [{ key: MetricFor.BUCKETS, value: 1 }] },
      {
        projectId: 'proj_1',
        metrics: [
          { key: MetricFor.FILES, value: 1 },
          { key: MetricFor.FILES_STORAGE, value: 1024 },
        ],
      },
      {
        projectId: 'proj_1',
        metrics: [
          { key: MetricFor.FILES, value: -1 },
          { key: MetricFor.FILES_STORAGE, value: -512 },
        ],
      },
      {
        projectId: 'proj_1',
        metrics: [
          { key: MetricFor.FILES, value: 1 },
          { key: MetricFor.FILES_STORAGE, value: 2048 },
          { key: '9.files', value: 1 },
          { key: '9.files.storage', value: 2048 },
        ],
      },
    ])

    expect(enqueued.at(-1)!.metrics).toEqual([
      { key: MetricFor.FILES, value: 1 },
      { key: MetricFor.FILES_STORAGE, value: 2048 },
      { key: '9.files', value: 1 },
      { key: '9.files.storage', value: 2048 },
    ])

    // Batch creates count the batch size (v1 DocumentsCreate parity).
    batchCreate([fakeDoc('users'), fakeDoc('users'), fakeDoc('users')])
    expect(enqueued.at(-1)!.metrics).toEqual([{ key: MetricFor.USERS, value: 3 }])
  })

  it('never breaks the request path over enqueue failures', async () => {
    const { database, listeners } = stubDatabase()
    wireStatsDatabase({
      projectId: 'proj_1',
      database,
      enqueue: async () => {
        throw new Error('redis down')
      },
    })

    const create = listeners.get('document_create')![0]!
    // Must not throw.
    create(fakeDoc('users'))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})

describe('statsRequestSource (v1 StatsHook parity)', () => {
  function makeApp(
    enqueue: (projectId: string, metrics: Array<{ key: string; value: number }>) => Promise<void>,
    auth: unknown = { type: 'session' },
  ) {
    return new Elysia()
      .derive('plugin', () => ({
        project: { status: 'resolved', project: { id: 'proj_1' } },
        auth,
      }))
      .use(statsRequestSource({ enqueue }))
      .get('/ping', () => ({ status: 'ok' }))
  }

  it('records requests/inbound/outbound per project', async () => {
    const enqueued: Array<{
      projectId: string
      metrics: Array<{ key: string; value: number }>
    }> = []

    const app = makeApp(async (projectId, metrics) => {
      enqueued.push({ projectId, metrics })
    })

    const res = await app.handle(
      new Request('http://localhost/ping', {
        method: 'GET',
        headers: { 'content-length': '0' },
      }),
    )
    expect(res.status).toBe(200)

    // afterResponse fires post-send; wait a tick for the async enqueue.
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(enqueued).toHaveLength(1)
    const metrics = enqueued[0]!.metrics
    expect(metrics.find((m) => m.key === MetricFor.REQUESTS)?.value).toBe(1)
    expect(metrics.find((m) => m.key === MetricFor.INBOUND)?.value).toBe(0)
    // v1 parity: serialized response body size.
    expect(metrics.find((m) => m.key === MetricFor.OUTBOUND)?.value).toBe(
      Buffer.byteLength(JSON.stringify({ status: 'ok' })),
    )
  })

  it('counts outbound bytes from the serialized response value', async () => {
    const enqueued: Array<{
      projectId: string
      metrics: Array<{ key: string; value: number }>
    }> = []

    const app = new Elysia()
      .derive('plugin', () => ({
        project: { status: 'resolved', project: { id: 'proj_1' } },
      }))
      .use(
        statsRequestSource({
          enqueue: async (projectId, metrics) => {
            enqueued.push({ projectId, metrics })
          },
        }),
      )
      .get('/ping', () => ({ status: 'ok', note: '0123456789' }))

    await app.handle(new Request('http://localhost/ping'))
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(enqueued).toHaveLength(1)
    // v1 parity: the serialized JSON body size (Fastify Content-Length).
    expect(enqueued[0]!.metrics.find((m) => m.key === MetricFor.OUTBOUND)?.value).toBe(
      Buffer.byteLength(JSON.stringify({ status: 'ok', note: '0123456789' })),
    )
  })

  it('skips API-key callers (v1 isAdminUser parity)', async () => {
    const enqueued: Array<{
      projectId: string
      metrics: Array<{ key: string; value: number }>
    }> = []

    const app = makeApp(
      async (projectId, metrics) => {
        enqueued.push({ projectId, metrics })
      },
      { type: 'apiKey', keyId: 'k1', mode: 'admin' },
    )

    await app.handle(new Request('http://localhost/ping'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(enqueued).toHaveLength(0)
  })

  it('skips requests without a resolved project', async () => {
    const enqueued: Array<{
      projectId: string
      metrics: Array<{ key: string; value: number }>
    }> = []

    const app = new Elysia()
      .use(
        statsRequestSource({
          enqueue: async (projectId, metrics) => {
            enqueued.push({ projectId, metrics })
          },
        }),
      )
      .get('/ping', () => 'ok')

    await app.handle(new Request('http://localhost/ping'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(enqueued).toHaveLength(0)
  })

  it('respects the enabled gate (v1 enableStats parity)', async () => {
    const enqueued: Array<{
      projectId: string
      metrics: Array<{ key: string; value: number }>
    }> = []

    const app = new Elysia()
      .derive('plugin', () => ({
        project: { status: 'resolved', project: { id: 'proj_1' } },
      }))
      .use(
        statsRequestSource({
          enqueue: async (projectId, metrics) => {
            enqueued.push({ projectId, metrics })
          },
          enabled: () => false,
        }),
      )
      .get('/ping', () => 'ok')

    await app.handle(new Request('http://localhost/ping'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(enqueued).toHaveLength(0)
  })
})
