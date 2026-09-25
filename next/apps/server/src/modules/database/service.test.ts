import { describe, expect, test } from 'bun:test'
import type { TenantResource } from '@nuvix/core/tenants'
import type { Database } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../shared/errors'
import {
  DatabaseService,
  PostgresSchemaStorage,
  type SchemaItem,
  type SchemaStorage,
} from './service'

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
      throw new NotFoundError('Schema not found', { code: 'schema_not_found' })
    }
    const updated = { ...existing, description: description ?? null }
    this.schemas.set(name, updated)
    return updated
  }

  async delete(name: string): Promise<void> {
    this.schemas.delete(name)
  }
}

describe('DatabaseService', () => {
  const fakeTenantResource = {
    getSql: () => ({}) as unknown as ReturnType<TenantResource['getSql']>,
    databaseForSchema: (_name: string) =>
      ({
        create: async () => {},
      }) as unknown as Database,
  } as unknown as TenantResource

  test('lists schemas and filters by type', async () => {
    const storage = new MemorySchemaStorage()
    const service = new DatabaseService(fakeTenantResource, storage)

    await service.createSchema({ name: 'app_data', type: 'managed', description: 'App data' })
    await service.createSchema({ name: 'logs_data', type: 'unmanaged', description: 'Logs' })

    const all = await service.getSchemas()
    expect(all.total).toBe(2)
    expect(all.data.map((s) => s.name)).toEqual(['app_data', 'logs_data'])

    const managedOnly = await service.getSchemas('managed')
    expect(managedOnly.total).toBe(1)
    expect(managedOnly.data[0]?.name).toBe('app_data')
  })

  test('gets schema by name and throws NotFoundError when missing', async () => {
    const storage = new MemorySchemaStorage()
    const service = new DatabaseService(fakeTenantResource, storage)

    await service.createSchema({ name: 'store', type: 'managed', description: 'Store' })

    const found = await service.getSchema('store')
    expect(found.name).toBe('store')
    expect(found.type).toBe('managed')

    await expect(service.getSchema('nonexistent')).rejects.toThrow(NotFoundError)
  })

  test('creates schema and prevents duplicates with ConflictError', async () => {
    const storage = new MemorySchemaStorage()
    const service = new DatabaseService(fakeTenantResource, storage)

    const created = await service.createSchema({ name: 'users_schema', type: 'managed' })
    expect(created.name).toBe('users_schema')

    await expect(service.createSchema({ name: 'users_schema', type: 'unmanaged' })).rejects.toThrow(
      ConflictError,
    )
  })

  test('creates document schema and initializes metadata collections', async () => {
    let createdDbName = ''
    const tenantResourceWithDb = {
      ...fakeTenantResource,
      databaseForSchema: (_name: string) =>
        ({
          create: async (n: string) => {
            createdDbName = n
          },
        }) as unknown as Database,
    } as unknown as TenantResource

    const storage = new MemorySchemaStorage()
    const service = new DatabaseService(tenantResourceWithDb, storage)

    const created = await service.createDocumentSchema({
      name: 'doc_schema',
      type: 'document',
      description: 'Document store',
    })

    expect(created.name).toBe('doc_schema')
    expect(createdDbName).toBe('doc_schema')
    expect(await storage.get('doc_schema')).not.toBeNull()
  })

  test('rolls back document schema creation when database.create fails', async () => {
    const tenantResourceWithFailingDb = {
      ...fakeTenantResource,
      databaseForSchema: (_name: string) =>
        ({
          create: async () => {
            throw new Error('Database create failed')
          },
        }) as unknown as Database,
    } as unknown as TenantResource

    const storage = new MemorySchemaStorage()
    const service = new DatabaseService(tenantResourceWithFailingDb, storage)

    await expect(
      service.createDocumentSchema({
        name: 'failing_schema',
        type: 'document',
      }),
    ).rejects.toThrow('Database create failed')

    expect(await storage.get('failing_schema')).toBeNull()
  })

  test('updates schema description and deletes schema', async () => {
    const storage = new MemorySchemaStorage()
    const service = new DatabaseService(fakeTenantResource, storage)

    await service.createSchema({ name: 'tenant_db', type: 'managed', description: 'Old' })
    const updated = await service.updateSchema('tenant_db', 'New description')
    expect(updated.description).toBe('New description')

    await service.deleteSchema('tenant_db')
    expect(await storage.get('tenant_db')).toBeNull()

    await expect(service.deleteSchema('tenant_db')).rejects.toThrow(NotFoundError)
  })

  test('PostgresSchemaStorage queries system.schemas via tenantResource.pg()', async () => {
    const fakeRows = [{ name: 'custom_schema', description: 'Custom', type: 'managed' }]
    const fakeQueryBuilder = Object.assign(Promise.resolve(fakeRows), {
      select: () => fakeQueryBuilder,
      whereNotIn: () => fakeQueryBuilder,
      where: () => fakeQueryBuilder,
      orderBy: () => fakeQueryBuilder,
      first: async () => fakeRows[0],
      update: async () => {},
      delete: async () => {},
    })
    const fakePg = {
      table: () => fakeQueryBuilder,
    } as unknown as ReturnType<TenantResource['pg']>

    const mockResource = {
      pg: () => fakePg,
      getSql: () => {
        const sqlFn = () => Promise.resolve([])
        sqlFn.unsafe = () => Promise.resolve([])
        return sqlFn as unknown as ReturnType<TenantResource['getSql']>
      },
    } as unknown as TenantResource

    const pgStorage = new PostgresSchemaStorage(mockResource)
    const list = await pgStorage.find('managed')
    expect(list.length).toBe(1)
    expect(list[0]?.name).toBe('custom_schema')

    const item = await pgStorage.get('custom_schema')
    expect(item?.name).toBe('custom_schema')

    await pgStorage.update('custom_schema', 'Updated')
    await pgStorage.delete('custom_schema')
  })
})
