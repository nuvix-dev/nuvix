import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import { Translator } from '@nuvix/i18n'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import type { BucketView } from './formatter'
import { storageRoutes } from './route'

describe('Storage Routes', () => {
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
              doc.get('bucketId') === val || doc.get('name') === val || doc.getId() === val
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
    sum: async (collection: string, attribute: string) => {
      const col = getCollection(collection)
      let total = 0
      for (const doc of col.values()) {
        total += Number(doc.get(attribute) ?? 0)
      }
      return total
    },
  } as unknown as Session

  const mockTenantResource = {
    authSystemSession: () => mockSession,
    authSession: () => mockSession,
  }

  const currentUser = new Doc({
    $id: 'user_1',
    name: 'Storage User',
    email: 'storage@example.com',
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
      tenantResource: mockTenantResource as never,
      isAPIUser: true,
      isAdmin: true,
    }))
    .use(storageRoutes())

  it('creates a bucket via POST /storage/buckets', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/storage/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Documents',
          enabled: true,
          maximumFileSize: 5_000_000,
        }),
      }),
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as BucketView
    expect(json.name).toBe('Documents')
    expect(json.$id).toBeDefined()
  })

  it('lists buckets via GET /storage/buckets', async () => {
    const res = await testApp.handle(new Request('http://localhost/storage/buckets'))

    expect(res.status).toBe(200)
    const json = (await res.json()) as { total: number; buckets: BucketView[] }
    expect(json.total).toBeGreaterThanOrEqual(1)
    expect(json.buckets.length).toBeGreaterThanOrEqual(1)
  })

  it('gets a bucket via GET /storage/buckets/:bucketId', async () => {
    // First create one
    const createRes = await testApp.handle(
      new Request('http://localhost/storage/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucketId: 'b_read',
          name: 'Read Bucket',
        }),
      }),
    )
    expect(createRes.status).toBe(200)

    const res = await testApp.handle(new Request('http://localhost/storage/buckets/b_read'))

    expect(res.status).toBe(200)
    const json = (await res.json()) as BucketView
    expect(json.name).toBe('Read Bucket')
  })

  it('updates a bucket via PUT /storage/buckets/:bucketId', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/storage/buckets/b_read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Read Bucket',
        }),
      }),
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as BucketView
    expect(json.name).toBe('Updated Read Bucket')
  })

  it('returns storage usage via GET /storage/usage', async () => {
    const res = await testApp.handle(new Request('http://localhost/storage/usage?range=30d'))

    expect(res.status).toBe(200)
    const json = (await res.json()) as { range: string; bucketsTotal: number }
    expect(json.range).toBe('30d')
    expect(json.bucketsTotal).toBeGreaterThanOrEqual(1)
  })

  it('deletes a bucket via DELETE /storage/buckets/:bucketId', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/storage/buckets/b_read', {
        method: 'DELETE',
      }),
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { status: string }
    expect(json.status).toBe('ok')
  })

  it('returns 404 for deleted bucket', async () => {
    const res = await testApp.handle(new Request('http://localhost/storage/buckets/b_read'))

    expect(res.status).toBe(404)
  })
})
