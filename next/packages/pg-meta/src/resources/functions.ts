/** PostgreSQL metadata resource: User-defined functions and routines. */
import { DEFAULT_SYSTEM_SCHEMAS, escapeLiteral, filterByList } from '../helpers'
import { functionsSql } from '../sql/functions'
import type { FilterOptions, PgFunction } from '../types'

/** Function introspection. Filters become WHERE fragments composed around the raw SQL template in `../sql`. */
export class PgMetaFunctions {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  /** List entries, applying optional include/exclude/limit/offset filters. */
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

  /** Retrieve a single entry by the given filter, or `null` when not found. */
  async retrieve(filter: { id: number }): Promise<PgFunction | null> {
    const sql = `WITH functions AS (${functionsSql}) SELECT * FROM functions WHERE id = ${escapeLiteral(filter.id)}`
    const rows = await this.query<PgFunction>(sql)
    return rows[0] ?? null
  }
}
