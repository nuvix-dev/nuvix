import { Memory } from '@nuvix/cache'
import { Adapter, Database } from '@nuvix/db'
import type { SQL } from 'bun'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors'
import { formatSchema } from './formatter'
import type { CreateSchemaInput, SchemaType, SchemaView, UpdateSchemaInput } from './types'

export const RESERVED_SCHEMAS = new Set([
  'system',
  'core',
  'internal',
  'auth',
  'realtime',
  'vault',
  'public',
  'information_schema',
  'pg_catalog',
])

const SCHEMA_NAME_REGEX = /^[a-z][a-z0-9_]{0,254}$/

interface SchemaRow {
  name: string
  description: string | null
  type: string
}

export class DatabaseService {
  constructor(
    private readonly sql: SQL,
    private readonly dbFactory?: (schemaName: string) => Database,
  ) {}

  private createDocumentDatabase(schemaName: string): Database {
    const adapter = new Adapter(this.sql)
    adapter.setMeta({ schema: schemaName, namespace: schemaName })
    return new Database(adapter, new Memory())
  }

  async list(type?: SchemaType): Promise<{ data: SchemaView[]; meta: { total: number } }> {
    let rows: SchemaRow[]
    if (type) {
      rows = await this.sql<SchemaRow[]>`
        select name, description, type
        from system.schemas
        where type = ${type}
        order by name asc
      `
    } else {
      rows = await this.sql<SchemaRow[]>`
        select name, description, type
        from system.schemas
        order by name asc
      `
    }

    const filtered = rows.filter((row) => !RESERVED_SCHEMAS.has(row.name)).map(formatSchema)

    return {
      data: filtered,
      meta: { total: filtered.length },
    }
  }

  async get(name: string): Promise<SchemaView> {
    if (RESERVED_SCHEMAS.has(name)) {
      throw new NotFoundError('Schema', { code: 'schema_not_found' })
    }

    const rows = await this.sql<SchemaRow[]>`
      select name, description, type
      from system.schemas
      where name = ${name}
      limit 1
    `
    const row = rows[0]
    if (!row) {
      throw new NotFoundError('Schema', { code: 'schema_not_found' })
    }

    return formatSchema(row)
  }

  async create(input: CreateSchemaInput): Promise<SchemaView> {
    if (!SCHEMA_NAME_REGEX.test(input.name) || RESERVED_SCHEMAS.has(input.name)) {
      throw new BadRequestError('Invalid schema name', { code: 'schema_invalid_name' })
    }

    const existing = await this.sql<Array<{ name: string }>>`
      select name from system.schemas where name = ${input.name} limit 1
    `
    if (existing.length > 0) {
      throw new ConflictError('Schema already exists', { code: 'schema_already_exists' })
    }

    await this.sql`
      select system.create_schema(${input.name}, ${input.type}, ${input.description ?? null})
    `

    if (input.type === 'document') {
      try {
        const db = this.dbFactory
          ? this.dbFactory(input.name)
          : this.createDocumentDatabase(input.name)
        await db.create(input.name)
      } catch (err) {
        try {
          await this.sql`delete from system.schemas where name = ${input.name}`
          await this.sql`drop schema if exists ${this.sql(input.name)} cascade`
        } catch {
          // preserve original error
        }
        throw err
      }
    }

    return this.get(input.name)
  }

  async update(name: string, input: UpdateSchemaInput): Promise<SchemaView> {
    if (RESERVED_SCHEMAS.has(name)) {
      throw new NotFoundError('Schema', { code: 'schema_not_found' })
    }

    const existing = await this.sql<Array<{ name: string }>>`
      select name from system.schemas where name = ${name} limit 1
    `
    if (existing.length === 0) {
      throw new NotFoundError('Schema', { code: 'schema_not_found' })
    }

    await this.sql`
      update system.schemas
      set description = ${input.description ?? null}
      where name = ${name}
    `

    return this.get(name)
  }

  async delete(name: string): Promise<void> {
    if (RESERVED_SCHEMAS.has(name)) {
      throw new NotFoundError('Schema', { code: 'schema_not_found' })
    }

    const existing = await this.sql<Array<{ name: string }>>`
      select name from system.schemas where name = ${name} limit 1
    `
    if (existing.length === 0) {
      throw new NotFoundError('Schema', { code: 'schema_not_found' })
    }

    await this.sql`
      drop schema if exists ${this.sql(name)} cascade
    `
    await this.sql`
      delete from system.schemas where name = ${name}
    `
  }
}
