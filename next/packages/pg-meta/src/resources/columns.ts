import { DEFAULT_SYSTEM_SCHEMAS, escapeLiteral, filterByList } from '../helpers'
import { columnsSql } from '../sql/columns'
import type { ColumnFilterOptions, PgColumn } from '../types'

export class PgMetaColumns {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  async list(options?: ColumnFilterOptions): Promise<PgColumn[]> {
    let sql = `WITH columns AS (${columnsSql}) SELECT * FROM columns WHERE true`

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
    if (options?.table !== undefined) {
      sql += ` AND "table" = ${escapeLiteral(options.table)}`
    }
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`
    }
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`
    }
    return this.query<PgColumn>(sql)
  }

  async retrieve(filter: {
    id?: string
    name?: string
    tableId?: number
    schema?: string
    table?: string
  }): Promise<PgColumn | null> {
    let sql = `WITH columns AS (${columnsSql}) SELECT * FROM columns WHERE true`

    if (filter.id !== undefined) {
      sql += ` AND id = ${escapeLiteral(filter.id)}`
    } else if (filter.name !== undefined && filter.tableId !== undefined) {
      sql += ` AND name = ${escapeLiteral(filter.name)} AND table_id = ${escapeLiteral(filter.tableId)}`
    } else if (filter.name !== undefined && filter.table !== undefined) {
      sql += ` AND name = ${escapeLiteral(filter.name)} AND "table" = ${escapeLiteral(filter.table)}`
      if (filter.schema) {
        sql += ` AND schema = ${escapeLiteral(filter.schema)}`
      }
    } else {
      throw new Error('Insufficient parameters to retrieve column')
    }

    const rows = await this.query<PgColumn>(sql)
    return rows[0] ?? null
  }
}
