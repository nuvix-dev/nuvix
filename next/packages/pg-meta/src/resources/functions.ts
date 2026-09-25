import { DEFAULT_SYSTEM_SCHEMAS, escapeLiteral, filterByList } from '../helpers'
import { functionsSql } from '../sql/functions'
import type { FilterOptions, PgFunction } from '../types'

export class PgMetaFunctions {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  async list(options?: FilterOptions): Promise<PgFunction[]> {
    let sql = `WITH functions AS (${functionsSql}) SELECT * FROM functions WHERE true`

    const filter = filterByList(
      options?.includedSchemas,
      options?.excludedSchemas,
      !options?.includeSystemSchemas ? DEFAULT_SYSTEM_SCHEMAS : undefined,
    )
    if (filter) {
      sql += ` AND schema ${filter}`
    }
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`
    }
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`
    }
    return this.query<PgFunction>(sql)
  }

  async retrieve(filter: { id: number }): Promise<PgFunction | null> {
    const sql = `WITH functions AS (${functionsSql}) SELECT * FROM functions WHERE id = ${escapeLiteral(filter.id)}`
    const rows = await this.query<PgFunction>(sql)
    return rows[0] ?? null
  }
}
