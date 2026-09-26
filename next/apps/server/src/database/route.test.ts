import { describe, expect, it } from 'bun:test'
import { treaty } from '@elysia/eden'
import type { TenantResource } from '@nuvix/core/tenants'
import type { Database } from '@nuvix/db'
import { Translator } from '@nuvix/i18n'
import { Elysia } from 'elysia'
import { problemErrors } from '../plugins/errors'
import { databaseRoutes } from './route'
import type { SchemaItem, SchemaStorage } from './service'

class MemorySchemaStorage implements SchemaStorage {
  private readonly schemas = new Map<string, SchemaItem>()

  async find(type?: string): Promise<SchemaItem[]> {
    const list = Array.from(this.schemas.values())
    if (type) {
      return list.filter((s) => s.type === type)
    }
    return list
  }

  async get(name: string): Promise<SchemaItem | null> {
    return this.schemas.get(name) ?? null
  }

  async create(schema: SchemaItem): Promise<SchemaItem> {
    this.schemas.set(schema.name, { ...schema })
    return schema
  }

  async update(name: string, description?: string | null): Promise<SchemaItem> {
    const existing = this.schemas.get(name)
    if (!existing) {
      throw new Error('Not found')
    }
    const updated = { ...existing, description: description ?? null }
    this.schemas.set(name, updated)
    return updated
  }

  async delete(name: string): Promise<void> {
    this.schemas.delete(name)
  }
}

describe('Database Routes', () => {
  const fakeTenantResource = {
    getSql: () => ({}) as unknown as ReturnType<TenantResource['getSql']>,
    databaseForSchema: (_name: string) =>
      ({
        create: async () => {},
      }) as unknown as Database,
  } as unknown as TenantResource

  it('rejects unauthorized non-admin users with 403', async () => {
    const storage = new MemorySchemaStorage()
    const nonAdminApp = new Elysia()
      .use(
        problemErrors({
          getTranslator: async () => new Translator('en', 'en', { primary: {}, fallback: {} }),
        }),
      )
      .derive('plugin', () => ({
        isAdmin: false,
        isAPIUser: false,
        tenantResource: fakeTenantResource,
      }))
      .use(databaseRoutes(storage))

    const client = treaty(nonAdminApp)
    const { status } = await client.database.schemas.get()
    expect(status).toBe(403)
  })

  it('performs full CRUD lifecycle on schemas for admin users', async () => {
    const storage = new MemorySchemaStorage()
    const app = new Elysia()
      .use(
        problemErrors({
          getTranslator: async () => new Translator('en', 'en', { primary: {}, fallback: {} }),
        }),
      )
      .derive('plugin', () => ({
        isAdmin: true,
        isAPIUser: false,
        tenantResource: fakeTenantResource,
      }))
      .use(databaseRoutes(storage))

    const client = treaty(app)

    // 1. List initially empty
    const listInitial = await client.database.schemas.get()
    expect(listInitial.status).toBe(200)
    expect(listInitial.data?.total).toBe(0)

    // 2. Create managed schema
    const created1 = await client.database.schemas.post({
      name: 'analytics',
      type: 'managed',
      description: 'Analytics data',
    })
    expect(created1.status).toBe(200)
    expect(created1.data?.name).toBe('analytics')
    expect(created1.data?.type).toBe('managed')

    // 3. Create document schema
    const created2 = await client.database.schemas.post({
      name: 'content',
      type: 'document',
      description: 'CMS content',
    })
    expect(created2.status).toBe(200)
    expect(created2.data?.name).toBe('content')

    // 4. List with filter
    const filteredList = await client.database.schemas.get({
      query: { type: 'managed' },
    })
    expect(filteredList.status).toBe(200)
    expect(filteredList.data?.total).toBe(1)
    expect(filteredList.data?.data[0]?.name).toBe('analytics')

    // 5. Get by ID
    const got = await client.database.schemas({ schemaId: 'analytics' }).get()
    expect(got.status).toBe(200)
    expect(got.data?.name).toBe('analytics')

    // 6. Update description
    const updated = await client.database.schemas({ schemaId: 'analytics' }).patch({
      description: 'Updated description',
    })
    expect(updated.status).toBe(200)
    expect(updated.data?.description).toBe('Updated description')

    // 7. Delete schema
    const deleted = await client.database.schemas({ schemaId: 'analytics' }).delete()
    expect(deleted.status).toBe(204)

    // 8. Confirm deletion
    const getAfterDelete = await client.database.schemas({ schemaId: 'analytics' }).get()
    expect(getAfterDelete.status).toBe(404)
  })
})
