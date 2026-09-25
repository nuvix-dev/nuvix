import { escapeLiteral } from '../helpers'
import { policiesSql } from '../sql/policies'
import type { PgPolicy } from '../types'

export interface PolicyFilterOptions {
  tableId?: number
  limit?: number
  offset?: number
}

export class PgMetaPolicies {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  async list(options?: PolicyFilterOptions): Promise<PgPolicy[]> {
    let sql = `WITH policies AS (${policiesSql}) SELECT * FROM policies WHERE true`
    if (options?.tableId !== undefined) {
      sql += ` AND table_id = ${escapeLiteral(options.tableId)}`
    }
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`
    }
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`
    }
    return this.query<PgPolicy>(sql)
  }

  async retrieve(filter: { id: number }): Promise<PgPolicy | null> {
    const sql = `WITH policies AS (${policiesSql}) SELECT * FROM policies WHERE id = ${escapeLiteral(filter.id)}`
    const rows = await this.query<PgPolicy>(sql)
    return rows[0] ?? null
  }
}
