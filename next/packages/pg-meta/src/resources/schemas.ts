import { DEFAULT_SYSTEM_SCHEMAS, escapeLiteral, filterByList } from '../helpers'
import { schemasSql } from '../sql/schemas'
import type { FilterOptions, PgSchema } from '../types'

export class PgMetaSchemas {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  async list(options?: FilterOptions): Promise<PgSchema[]> {
    let sql = `WITH schemas AS (${schemasSql}) SELECT * FROM schemas WHERE true`
    const filter = filterByList(
      options?.includedSchemas,
      options?.excludedSchemas,
      !options?.includeSystemSchemas ? DEFAULT_SYSTEM_SCHEMAS : undefined,
    )
    if (filter) {
      sql += ` AND name ${filter}`
    }
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`
    }
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`
    }
    return this.query<PgSchema>(sql)
  }

  async retrieve(filter: { id?: number; name?: string }): Promise<PgSchema | null> {
    let sql = `WITH schemas AS (${schemasSql}) SELECT * FROM schemas WHERE true`
    if (filter.id !== undefined) {
      sql += ` AND id = ${escapeLiteral(filter.id)}`
    } else if (filter.name !== undefined) {
      sql += ` AND name = ${escapeLiteral(filter.name)}`
    } else {
      throw new Error('Either id or name must be provided to retrieve schema')
    }
    const rows = await this.query<PgSchema>(sql)
    return rows[0] ?? null
  }
}
