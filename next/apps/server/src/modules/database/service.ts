import type { TenantResource } from '@nuvix/core/tenants'
import { Schemas, type SchemaType } from '@nuvix/utils'
import { ConflictError, NotFoundError } from '../../shared/errors'

export interface SchemaItem {
  name: string
  type: SchemaType | 'managed' | 'unmanaged' | 'document'
  description?: string | null
}

export interface SchemaStorage {
  find(type?: string): Promise<SchemaItem[]>
  get(name: string): Promise<SchemaItem | null>
  create(schema: SchemaItem): Promise<SchemaItem>
  update(name: string, description?: string | null): Promise<SchemaItem>
  delete(name: string): Promise<void>
}

export class PostgresSchemaStorage implements SchemaStorage {
  constructor(private readonly tenantResource: TenantResource) {}

  async find(type?: string): Promise<SchemaItem[]> {
    const sql = this.tenantResource.getSql()
    const reserved = [
      Schemas.Core,
      Schemas.System,
      Schemas.Internal,
      'public',
      'auth',
      'vault',
      'realtime',
    ]

    let rows: Array<{ name: string; description: string | null; type: string }>
    if (type) {
      rows = await sql`
        SELECT name, description, type FROM system.schemas
        WHERE name NOT IN ${sql(reserved)} AND type = ${type}
        ORDER BY name ASC
      `
    } else {
      rows = await sql`
        SELECT name, description, type FROM system.schemas
        WHERE name NOT IN ${sql(reserved)}
        ORDER BY name ASC
      `
    }

    return rows.map((r) => ({
      name: r.name,
      description: r.description,
      type: r.type as SchemaItem['type'],
    }))
  }

  async get(name: string): Promise<SchemaItem | null> {
    const sql = this.tenantResource.getSql()
    const rows = await sql<Array<{ name: string; description: string | null; type: string }>>`
      SELECT name, description, type FROM system.schemas
      WHERE name = ${name}
      LIMIT 1
    `
    if (!rows || rows.length === 0 || !rows[0]) return null
    return {
      name: rows[0].name,
      description: rows[0].description,
      type: rows[0].type as SchemaItem['type'],
    }
  }

  async create(schema: SchemaItem): Promise<SchemaItem> {
    const sql = this.tenantResource.getSql()
    await sql`SELECT system.create_schema(${schema.name}, ${schema.type}, ${schema.description ?? null})`
    const created = await this.get(schema.name)
    return created ?? schema
  }

  async update(name: string, description?: string | null): Promise<SchemaItem> {
    const sql = this.tenantResource.getSql()
    await sql`
      UPDATE system.schemas
      SET description = ${description ?? null}
      WHERE name = ${name}
    `
    const updated = await this.get(name)
    if (!updated) {
      throw new NotFoundError('Schema not found', { code: 'schema_not_found' })
    }
    return updated
  }

  async delete(name: string): Promise<void> {
    const sql = this.tenantResource.getSql()
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${name.replace(/"/g, '""')}" CASCADE`)
    // Also remove from system.schemas in case DDL trigger was not triggered
    await sql`DELETE FROM system.schemas WHERE name = ${name}`
  }
}

export class DatabaseService {
  private readonly storage: SchemaStorage

  constructor(
    private readonly tenantResource: TenantResource,
    storage?: SchemaStorage,
  ) {
    this.storage = storage ?? new PostgresSchemaStorage(tenantResource)
  }

  /**
   * List all schemas in the database with optional type filter.
   */
  async getSchemas(type?: string): Promise<{ data: SchemaItem[]; total: number }> {
    const schemas = await this.storage.find(type)
    return {
      data: schemas,
      total: schemas.length,
    }
  }

  /**
   * Get a schema by name.
   */
  async getSchema(name: string): Promise<SchemaItem> {
    const schema = await this.storage.get(name)
    if (!schema) {
      throw new NotFoundError('Schema not found', { code: 'schema_not_found' })
    }
    return schema
  }

  /**
   * Create a standard schema (managed or unmanaged).
   */
  async createSchema(data: {
    name: string
    type: SchemaType | 'managed' | 'unmanaged' | 'document'
    description?: string | null
  }): Promise<SchemaItem> {
    const existing = await this.storage.get(data.name)
    if (existing) {
      throw new ConflictError('Schema already exists, please choose another name', {
        code: 'schema_already_exists',
      })
    }

    return this.storage.create({
      name: data.name,
      type: data.type,
      description: data.description ?? null,
    })
  }

  /**
   * Create a document schema and initialize @nuvix/db metadata collection.
   */
  async createDocumentSchema(data: {
    name: string
    type: SchemaType | 'managed' | 'unmanaged' | 'document'
    description?: string | null
  }): Promise<SchemaItem> {
    const existing = await this.storage.get(data.name)
    if (existing) {
      throw new ConflictError('Schema already exists, please choose another name', {
        code: 'schema_already_exists',
      })
    }

    const schema = await this.storage.create({
      name: data.name,
      type: data.type,
      description: data.description ?? null,
    })

    try {
      const db = this.tenantResource.databaseForSchema(data.name)
      await db.create(data.name)
    } catch (error) {
      // Rollback on failure to maintain schema consistency
      await this.storage.delete(data.name)
      throw error
    }

    return schema
  }

  /**
   * Update a schema's description.
   */
  async updateSchema(name: string, description?: string | null): Promise<SchemaItem> {
    const existing = await this.storage.get(name)
    if (!existing) {
      throw new NotFoundError('Schema not found', { code: 'schema_not_found' })
    }

    return this.storage.update(name, description)
  }

  /**
   * Delete a schema and its objects.
   */
  async deleteSchema(name: string): Promise<void> {
    const existing = await this.storage.get(name)
    if (!existing) {
      throw new NotFoundError('Schema not found', { code: 'schema_not_found' })
    }

    await this.storage.delete(name)
  }
}
