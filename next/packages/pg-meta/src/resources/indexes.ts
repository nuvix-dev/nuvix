import { DEFAULT_SYSTEM_SCHEMAS, escapeLiteral, filterByList } from '../helpers'
import { indexesSql } from '../sql/indexes'
import type { FilterOptions, PgIndex } from '../types'

export interface IndexFilterOptions extends FilterOptions {
  tableId?: number
}

export class PgMetaIndexes {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  async list(options?: IndexFilterOptions): Promise<PgIndex[]> {
    let sql = `WITH indexes AS (${indexesSql}) SELECT * FROM indexes WHERE true`

    const filter = filterByList(
      options?.includedSchemas,
      options?.excludedSchemas,
      !options?.includeSystemSchemas ? DEFAULT_SYSTEM_SCHEMAS : undefined,
    )
    if (filter) {
      sql += ` AND schema ${filter}`
    }
    if (options?.tableId !== undefined) {
      sql += ` AND table_id = ${escapeLiteral(options.tableId)}`
    }
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`
    }
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`
    }
    return this.query<PgIndex>(sql)
  }

  async retrieve(filter: { id: number }): Promise<PgIndex | null> {
    const sql = `WITH indexes AS (${indexesSql}) SELECT * FROM indexes WHERE id = ${escapeLiteral(filter.id)}`
    const rows = await this.query<PgIndex>(sql)
    return rows[0] ?? null
  }
}
