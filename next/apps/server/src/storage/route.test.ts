import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import { Translator } from '@nuvix/i18n'
import { Elysia } from 'elysia'
import { problemErrors } from '../plugins/errors'
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
    findOne: async (
      collection: string,
      query: (qb: { equal: (a: string, v: unknown) => unknown }) => unknown,
    ) => {
      // Usage stats reads: return recorded INF totals for the metric.
      const builder = {
        metric: undefined as string | undefined,
        period: undefined as string | undefined,
        equal(a: string, v: unknown) {
          if (a === 'metric') this.metric = v as string
          if (a === 'period') this.period = v as string
          return this
        },
      }
      query(builder as never)
      if (collection === 'stats' && builder.metric && builder.period === 'inf') {
        return new Doc({ $id: 'inf', metric: builder.metric, period: 'inf', value: 1 })
      }
      return new Doc({})
    },
  } as unknown as Session

  process.env.NUVIX_JWT_SECRET ??= 'test-jwt-secret'
  const mockTenantResource = {
    projectId: 'proj_test',
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

  it('streams push assets for a valid signed JWT (v1 parity)', async () => {
    const { signJwt } = await import('@nuvix/core/auth')
    const fs = await import('node:fs/promises')
    const assetPath = '/tmp/opencode/push-asset-test.png'
    await fs.writeFile(assetPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01]))

    await mockSession.createDocument(
      'buckets',
      new Doc({
        $id: 'b_push',
        name: 'Push Bucket',
        enabled: true,
        $permissions: [],
      }),
    )
    await mockSession.createDocument(
      'files',
      new Doc({
        $id: 'push_file',
        bucketId: 'b_push',
        name: 'asset.png',
        path: assetPath,
        mimeType: 'image/png',
        sizeOriginal: 5,
        $permissions: [],
      }),
    )

    const jwt = await signJwt(
      { projectId: 'proj_test', bucketId: 'b_push', fileId: 'push_file' },
      process.env.NUVIX_JWT_SECRET!,
      3600,
    )

    const res = await testApp.handle(
      new Request(`http://localhost/storage/buckets/b_push/files/push_file/push?jwt=${jwt}`),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.headers.get('Content-Disposition')).toContain('inline')
    expect(res.headers.get('Expires')).toBeDefined()
    const body = new Uint8Array(await res.arrayBuffer())
    expect([...body]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x01])
  })

  it('rejects push asset requests with an invalid JWT (401)', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/storage/buckets/b_push/files/push_file/push?jwt=bogus'),
    )
    expect(res.status).toBe(401)
  })

  it('rejects push asset requests whose claims do not match (401)', async () => {
    const { signJwt } = await import('@nuvix/core/auth')
    const jwt = await signJwt(
      { projectId: 'proj_test', bucketId: 'b_push', fileId: 'OTHER_file' },
      process.env.NUVIX_JWT_SECRET!,
      3600,
    )
    const res = await testApp.handle(
      new Request(`http://localhost/storage/buckets/b_push/files/push_file/push?jwt=${jwt}`),
    )
    expect(res.status).toBe(401)
  })

  it('hides push assets of disabled buckets (404)', async () => {
    const { signJwt } = await import('@nuvix/core/auth')
    await mockSession.createDocument(
      'buckets',
      new Doc({
        $id: 'b_push_off',
        name: 'Disabled Push Bucket',
        enabled: false,
        $permissions: [],
      }),
    )
    await mockSession.createDocument(
      'files',
      new Doc({
        $id: 'push_file_off',
        bucketId: 'b_push_off',
        name: 'asset.png',
        path: '/tmp/opencode/push-asset-test.png',
        mimeType: 'image/png',
        sizeOriginal: 5,
        $permissions: [],
      }),
    )
    const jwt = await signJwt(
      { projectId: 'proj_test', bucketId: 'b_push_off', fileId: 'push_file_off' },
      process.env.NUVIX_JWT_SECRET!,
      3600,
    )
    const res = await testApp.handle(
      new Request(
        `http://localhost/storage/buckets/b_push_off/files/push_file_off/push?jwt=${jwt}`,
      ),
    )
    expect(res.status).toBe(404)
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
