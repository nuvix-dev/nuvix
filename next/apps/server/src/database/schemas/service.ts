/** Owns tenant schema metadata and coordinates PostgreSQL DDL with document-store initialization. */
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

interface SystemSchemaRow {
  name: string
  description: string | null
  type: string
}

/** Persists schema metadata in the tenant control tables and executes matching DDL. */
export class PostgresSchemaStorage implements SchemaStorage {
  constructor(private readonly tenantResource: TenantResource) {}

  async find(type?: string): Promise<SchemaItem[]> {
    const reserved = [
      Schemas.Core,
      Schemas.System,
      Schemas.Internal,
      'public',
      'auth',
      'vault',
      'realtime',
    ]

    let builder = this.tenantResource
      .pg()
      .table('system.schemas')
      .select('name', 'description', 'type')
      .whereNotIn('name', reserved)
      .orderBy('name', 'asc')

    if (type) {
      builder = builder.where('type', '=', type)
    }

    const rows = (await builder) as SystemSchemaRow[]

    return rows.map((r) => ({
      name: r.name,
      description: r.description,
      type: r.type as SchemaItem['type'],
    }))
  }

  async get(name: string): Promise<SchemaItem | null> {
    const row = (await this.tenantResource
      .pg()
      .table('system.schemas')
      .select('name', 'description', 'type')
      .where('name', '=', name)
      .first()) as SystemSchemaRow | undefined

    if (!row) return null
    return {
      name: row.name,
      description: row.description,
      type: row.type as SchemaItem['type'],
    }
  }

  async create(schema: SchemaItem): Promise<SchemaItem> {
    const sql = this.tenantResource.getSql()
    await sql`SELECT system.create_schema(${schema.name}, ${schema.type}, ${schema.description ?? null})`
    const created = await this.get(schema.name)
    return created ?? schema
  }

  async update(name: string, description?: string | null): Promise<SchemaItem> {
    await this.tenantResource
      .pg()
      .table('system.schemas')
      .where('name', '=', name)
      .update({ description: description ?? null })

    const updated = await this.get(name)
    if (!updated) {
      throw new NotFoundError('Schema not found', { code: 'schema_not_found' })
    }
    return updated
  }

  async delete(name: string): Promise<void> {
    const sql = this.tenantResource.getSql()
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${name.replace(/"/g, '""')}" CASCADE`)
    // Remove metadata explicitly in case the database DDL hook did not run.
    await this.tenantResource.pg().table('system.schemas').where('name', '=', name).delete()
  }
}

/** Applies authorization-independent schema rules over an injected storage boundary. */
export class DatabaseService {
  private readonly storage: SchemaStorage

  constructor(
    private readonly tenantResource: TenantResource,
    storage?: SchemaStorage,
  ) {
    this.storage = storage ?? new PostgresSchemaStorage(tenantResource)
  }

  /** List schemas with an optional type filter. */
  async getSchemas(type?: string): Promise<{ data: SchemaItem[]; total: number }> {
    const schemas = await this.storage.find(type)
    return {
      data: schemas,
      total: schemas.length,
    }
  }

  /** Retrieve one schema by name. */
  async getSchema(name: string): Promise<SchemaItem> {
    const schema = await this.storage.get(name)
    if (!schema) {
      throw new NotFoundError('Schema not found', { code: 'schema_not_found' })
    }
    return schema
  }

  /** Create a managed, unmanaged, or document schema after duplicate checking. */
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

  /** Create a document schema and initialize its document collection atomically. */
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

  /** Update a schema description after confirming the schema exists. */
  async updateSchema(name: string, description?: string | null): Promise<SchemaItem> {
    const existing = await this.storage.get(name)
    if (!existing) {
      throw new NotFoundError('Schema not found', { code: 'schema_not_found' })
    }

    return this.storage.update(name, description)
  }

  /** Delete a schema and its database objects after existence checking. */
  async deleteSchema(name: string): Promise<void> {
    const existing = await this.storage.get(name)
    if (!existing) {
      throw new NotFoundError('Schema not found', { code: 'schema_not_found' })
    }

    await this.storage.delete(name)
  }
}
