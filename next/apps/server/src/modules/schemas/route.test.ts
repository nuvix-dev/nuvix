import { describe, expect, it } from 'bun:test'
import { treaty } from '@elysia/eden'
import type { TenantResource } from '@nuvix/core/tenants'
import {
  type Attribute,
  type Collection,
  Database,
  Doc,
  type Index,
  IndexType,
  type Permission,
  type Session,
} from '@nuvix/db'
import { Translator } from '@nuvix/i18n'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import { schemasRoutes } from './route'

describe('Schemas Routes (Collections, Attributes, Indexes, Documents)', () => {
  const collectionsMap = new Map<string, Doc<Collection>>()
  const documentsMap = new Map<string, Doc>()

  const mockDb = {
    createCollection: async ({
      id,
      permissions,
      documentSecurity,
      enabled,
    }: {
      id: string
      permissions?: (string | Permission)[]
      documentSecurity?: boolean
      enabled?: boolean
    }) => {
      const doc = new Doc<Collection>({
        $id: id,
        $collection: Database.METADATA,
        name: id,
        $permissions: (permissions ?? []).map((p) => p.toString()),
        documentSecurity: documentSecurity ?? true,
        enabled: enabled ?? true,
        attributes: [],
        indexes: [],
      })
      collectionsMap.set(id, doc)
      return doc
    },
    getCollection: async (id: string) => {
      return collectionsMap.get(id) ?? new Doc<Collection>()
    },
    updateCollection: async ({
      id,
      permissions,
      documentSecurity,
      enabled,
    }: {
      id: string
      permissions?: (string | Permission)[]
      documentSecurity?: boolean
      enabled?: boolean
    }) => {
      const doc = collectionsMap.get(id)
      if (!doc) {
        return new Doc<Collection>()
      }
      if (permissions !== undefined) doc.set('permissions', permissions)
      if (documentSecurity !== undefined) doc.set('documentSecurity', documentSecurity)
      if (enabled !== undefined) doc.set('enabled', enabled)
      return doc
    },
    deleteCollection: async (id: string) => {
      collectionsMap.delete(id)
    },
    createAttribute: async (colId: string, attr: Attribute) => {
      const doc = collectionsMap.get(colId)
      if (doc) {
        const attrs = (doc.get('attributes') ?? []) as Doc<Attribute>[]
        attrs.push(new Doc<Attribute>(attr))
        doc.set('attributes', attrs)
      }
      return new Doc<Attribute>(attr)
    },
    updateAttributeRequired: async (colId: string, key: string, req: boolean) => {
      const doc = collectionsMap.get(colId)
      if (doc) {
        const attrs = (doc.get('attributes') ?? []) as Doc<Attribute>[]
        const found = attrs.find(
          (a) => (a instanceof Doc ? a.get('key') : (a as unknown as Attribute).key) === key,
        )
        if (found) {
          if (found instanceof Doc) found.set('required', req)
          else (found as unknown as Attribute).required = req
        }
      }
    },
    deleteAttribute: async (colId: string, key: string) => {
      const doc = collectionsMap.get(colId)
      if (doc) {
        const attrs = (doc.get('attributes') ?? []) as Doc<Attribute>[]
        doc.set(
          'attributes',
          attrs.filter(
            (a) => (a instanceof Doc ? a.get('key') : (a as unknown as Attribute).key) !== key,
          ),
        )
      }
    },
    createIndex: async (
      colId: string,
      key: string,
      type: IndexType,
      attributes: string[],
      orders: string[],
    ) => {
      const doc = collectionsMap.get(colId)
      if (doc) {
        const idxs = (doc.get('indexes') ?? []) as Doc<Index>[]
        idxs.push(new Doc<Index>({ $id: key, key, type, attributes, orders }))
        doc.set('indexes', idxs)
      }
      return new Doc<Index>({ $id: key, key, type, attributes, orders })
    },
    deleteIndex: async (colId: string, key: string) => {
      const doc = collectionsMap.get(colId)
      if (doc) {
        const idxs = (doc.get('indexes') ?? []) as Doc<Index>[]
        doc.set(
          'indexes',
          idxs.filter(
            (i) => (i instanceof Doc ? i.get('key') : (i as unknown as Index).key) !== key,
          ),
        )
      }
    },
    system: () => ({
      find: async () => Array.from(collectionsMap.values()),
      count: async () => collectionsMap.size,
      updateDocument: async (_col: string, id: string, doc: Doc<Collection>) => {
        collectionsMap.set(id, doc)
        return doc
      },
    }),
  } as unknown as Database

  const mockSession = {
    find: async () => Array.from(documentsMap.values()),
    count: async () => documentsMap.size,
    getDocument: async (_col: string, id: string) => documentsMap.get(id) ?? new Doc({}),
    createDocument: async (_col: string, doc: Doc) => {
      documentsMap.set(doc.getId(), doc)
      return doc
    },
    updateDocument: async (_col: string, id: string, doc: Doc) => {
      documentsMap.set(id, doc)
      return doc
    },
    deleteDocument: async (_col: string, id: string) => {
      documentsMap.delete(id)
    },
  } as unknown as Session

  const rowsMap = new Map<string, unknown>()

  const mockSql = {
    unsafe: async (q: string, p: unknown[] = []) => {
      if (q.includes('COUNT(*)')) return [{ count: rowsMap.size }]
      if (q.includes('INSERT INTO')) {
        const item = {
          id: 1,
          name: (p[0] as string) ?? 'Alice',
          email: (p[1] as string) ?? 'alice@example.com',
        }
        rowsMap.set('1', item)
        return [item]
      }
      if (q.includes('WHERE id::text = $1')) {
        const item = rowsMap.get(String(p[0]))
        return item ? [item] : []
      }
      if (q.includes('DELETE FROM')) {
        rowsMap.clear()
        return [{ id: 1 }]
      }
      if (q.includes('calculate_total')) {
        return [{ sum: 42 }]
      }
      return Array.from(rowsMap.values())
    },
  }

  const fakeTenantResource = {
    databaseForSchema: () => mockDb,
    sessionForSchema: () => mockSession,
    getSql: () => mockSql,
  } as unknown as TenantResource

  const app = new Elysia()

    .use(
      problemErrors({
        getTranslator: async () => new Translator('en', 'en', { primary: {}, fallback: {} }),
      }),
    )
    .derive('plugin', () => ({
      isAdmin: true,
      isAPIUser: false,
      user: new Doc({ $id: 'admin_user' }),
      tenantResource: fakeTenantResource,
      db: mockSession,
      roles: ['user:admin_user', 'admin'],
    }))
    .use(schemasRoutes())

  const client = treaty(app)

  it('runs complete collections lifecycle via Eden Treaty', async () => {
    // 1. Create collection
    const created = await client.schemas({ schemaId: 'public' }).collections.post({
      collectionId: 'todos',
      name: 'Todos',
      documentSecurity: true,
      enabled: true,
    })
    expect(created.status).toBe(200)
    expect(created.data?.$id).toBe('todos')

    // 2. List collections
    const list = await client.schemas({ schemaId: 'public' }).collections.get()
    expect(list.status).toBe(200)
    expect(list.data?.total).toBe(1)

    // 3. Get collection
    const got = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .get()
    expect(got.status).toBe(200)
    expect(got.data?.$id).toBe('todos')

    // 4. Update collection
    const updated = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .put({
        name: 'Todos List',
      })
    expect(updated.status).toBe(200)

    // 5. Get usage
    const usage = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .usage.get()
    expect(usage.status).toBe(200)
  })

  it('runs attributes lifecycle via Eden Treaty', async () => {
    // 1. Create string attribute
    const attr = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .attributes.string.post({
        key: 'task',
        size: 255,
        required: true,
      })
    expect(attr.status).toBe(200)
    expect(attr.data?.key).toBe('task')

    // 2. Create boolean attribute
    const doneAttr = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .attributes.boolean.post({
        key: 'completed',
        default: false,
      })
    expect(doneAttr.status).toBe(200)
    expect(doneAttr.data?.key).toBe('completed')

    // 3. List attributes
    const attrsList = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .attributes.get()
    expect(attrsList.status).toBe(200)
    expect(attrsList.data?.total).toBe(2)

    // 4. Get single attribute
    const getAttr = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .attributes({ key: 'task' })
      .get()
    expect(getAttr.status).toBe(200)
    expect(getAttr.data?.key).toBe('task')

    // 5. Update attribute
    const updatedAttr = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .attributes({ key: 'task' })
      .patch({ required: false })
    expect(updatedAttr.status).toBe(200)

    // 6. Delete attribute
    const delAttr = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .attributes({ key: 'completed' })
      .delete()
    expect(delAttr.status).toBe(204)
  })

  it('runs indexes lifecycle via Eden Treaty', async () => {
    // 1. Create index
    const createdIdx = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .indexes.post({
        key: 'idx_task',
        type: IndexType.Key,
        attributes: ['task'],
      })
    expect(createdIdx.status).toBe(200)
    expect(createdIdx.data?.key).toBe('idx_task')

    // 2. List indexes
    const list = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .indexes.get()
    expect(list.status).toBe(200)
    expect(list.data?.total).toBe(1)

    // 3. Get index
    const got = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .indexes({ key: 'idx_task' })
      .get()
    expect(got.status).toBe(200)
    expect(got.data?.key).toBe('idx_task')

    // 4. Delete index
    const del = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .indexes({ key: 'idx_task' })
      .delete()
    expect(del.status).toBe(204)
  })

  it('runs documents lifecycle via Eden Treaty', async () => {
    // 1. Create document
    const created = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .documents.post({
        documentId: 'todo_1',
        data: { task: 'Buy milk', completed: false },
      })
    expect(created.status).toBe(200)
    expect(created.data?.$id).toBe('todo_1')
    expect(created.data?.task).toBe('Buy milk')

    // 2. List documents
    const list = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .documents.get()
    expect(list.status).toBe(200)
    expect(list.data?.total).toBe(1)

    // 3. Get document
    const got = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .documents({ documentId: 'todo_1' })
      .get()
    expect(got.status).toBe(200)
    expect(got.data?.$id).toBe('todo_1')
    expect(got.data?.task).toBe('Buy milk')

    // 4. Update document
    const updated = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .documents({ documentId: 'todo_1' })
      .patch({
        data: { completed: true },
      })
    expect(updated.status).toBe(200)
    expect(updated.data?.completed).toBe(true)

    // 5. Delete document
    const del = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .documents({ documentId: 'todo_1' })
      .delete()
    expect(del.status).toBe(204)

    // 6. Delete collection
    const delCol = await client
      .schemas({ schemaId: 'public' })
      .collections({ collectionId: 'todos' })
      .delete()
    expect(delCol.status).toBe(204)
  })

  it('runs tables lifecycle via Eden Treaty on schemas/:schemaId/tables', async () => {
    // 1. Insert row
    const insertRes = await client
      .schemas({ schemaId: 'public' })
      .tables({ tableId: 'users' })
      .post({ name: 'Bob', email: 'bob@example.com' })
    expect(insertRes.status).toBe(200)

    // 2. Query table
    const listRes = await client.schemas({ schemaId: 'public' }).tables({ tableId: 'users' }).get()
    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.data)).toBe(true)

    // 3. Count table
    const countRes = await client
      .schemas({ schemaId: 'public' })
      .tables({ tableId: 'users' })
      .count.get()
    expect(countRes.status).toBe(200)
    expect(countRes.data?.count).toBeGreaterThanOrEqual(1)

    // 4. Get single row
    const rowRes = await client
      .schemas({ schemaId: 'public' })
      .tables({ tableId: 'users' })({ rowId: '1' })
      .get()
    expect(rowRes.status).toBe(200)
    expect((rowRes.data as { id: number })?.id).toBe(1)

    // 5. Update row
    const patchRes = await client
      .schemas({ schemaId: 'public' })
      .tables({ tableId: 'users' })({ rowId: '1' })
      .patch({ name: 'Robert' })
    expect(patchRes.status).toBe(200)

    // 6. Delete row
    const delRes = await client
      .schemas({ schemaId: 'public' })
      .tables({ tableId: 'users' })({ rowId: '1' })
      .delete()
    expect(delRes.status).toBe(200)

    // 7. Call RPC
    const rpcRes = await client
      .schemas({ schemaId: 'public' })
      .rpc({ functionId: 'calculate_total' })
      .post([10, 32])
    expect(rpcRes.status).toBe(200)
  })

  it('runs public tables and rpc shorthand via Eden Treaty on public/*', async () => {
    // 1. Public insert
    const insertRes = await client.public.tables({ tableId: 'users' }).post({
      name: 'Charlie',
      email: 'charlie@example.com',
    })
    expect(insertRes.status).toBe(200)

    // 2. Public query
    const listRes = await client.public.tables({ tableId: 'users' }).get()
    expect(listRes.status).toBe(200)

    // 3. Public count
    const countRes = await client.public.tables({ tableId: 'users' }).count.get()
    expect(countRes.status).toBe(200)

    // 4. Public single row
    const rowRes = await client.public.tables({ tableId: 'users' })({ rowId: '1' }).get()
    expect(rowRes.status).toBe(200)

    // 5. Public RPC
    const rpcRes = await client.public.rpc({ functionId: 'calculate_total' }).post([5, 5])
    expect(rpcRes.status).toBe(200)
  })
})
