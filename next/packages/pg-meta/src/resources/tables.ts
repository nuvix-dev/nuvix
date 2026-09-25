import {
  coalesceRowsToArray,
  DEFAULT_SYSTEM_SCHEMAS,
  escapeLiteral,
  filterByList,
} from '../helpers'
import { columnsSql } from '../sql/columns'
import { tablesSql } from '../sql/tables'
import type { PgTable, TableFilterOptions } from '../types'

export class PgMetaTables {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  async list(options?: TableFilterOptions): Promise<PgTable[]> {
    const includeColumns = options?.includeColumns ?? false
    let sql = `WITH tables AS (${tablesSql})${
      includeColumns ? `, columns AS (${columnsSql})` : ''
    } SELECT tables.*${
      includeColumns ? `, ${coalesceRowsToArray('columns', 'columns.table_id = tables.id')}` : ''
    } FROM tables WHERE true`

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
    return this.query<PgTable>(sql)
  }

  async retrieve(filter: {
    id?: number
    name?: string
    schema?: string
    includeColumns?: boolean
  }): Promise<PgTable | null> {
    const includeColumns = filter.includeColumns ?? true
    let sql = `WITH tables AS (${tablesSql})${
      includeColumns ? `, columns AS (${columnsSql})` : ''
    } SELECT tables.*${
      includeColumns ? `, ${coalesceRowsToArray('columns', 'columns.table_id = tables.id')}` : ''
    } FROM tables WHERE true`

    if (filter.id !== undefined) {
      sql += ` AND tables.id = ${escapeLiteral(filter.id)}`
    } else if (filter.name !== undefined) {
      sql += ` AND tables.name = ${escapeLiteral(filter.name)}`
      if (filter.schema) {
        sql += ` AND tables.schema = ${escapeLiteral(filter.schema)}`
      }
    } else {
      throw new Error('Either id or name must be provided to retrieve table')
    }

    const rows = await this.query<PgTable>(sql)
    return rows[0] ?? null
  }
}
