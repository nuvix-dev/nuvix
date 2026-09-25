import { DEFAULT_SYSTEM_SCHEMAS, escapeLiteral, filterByList } from '../helpers'
import { viewsSql } from '../sql/views'
import type { FilterOptions, PgView } from '../types'

export class PgMetaViews {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  async list(options?: FilterOptions): Promise<PgView[]> {
    let sql = `WITH views AS (${viewsSql}) SELECT * FROM views WHERE true`

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
    return this.query<PgView>(sql)
  }

  async retrieve(filter: { id?: number; name?: string; schema?: string }): Promise<PgView | null> {
    let sql = `WITH views AS (${viewsSql}) SELECT * FROM views WHERE true`

    if (filter.id !== undefined) {
      sql += ` AND id = ${escapeLiteral(filter.id)}`
    } else if (filter.name !== undefined) {
      sql += ` AND name = ${escapeLiteral(filter.name)}`
      if (filter.schema) {
        sql += ` AND schema = ${escapeLiteral(filter.schema)}`
      }
    } else {
      throw new Error('Either id or name must be provided to retrieve view')
    }

    const rows = await this.query<PgView>(sql)
    return rows[0] ?? null
  }
}
