/** PostgreSQL metadata resource: Custom types defined in the database. */
import { DEFAULT_SYSTEM_SCHEMAS, escapeLiteral, filterByList } from '../helpers'
import { typesSql } from '../sql/types'
import type { FilterOptions, PgType } from '../types'

/** Type introspection. Filters become WHERE fragments composed around the raw SQL template in `../sql`. */
export class PgMetaTypes {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  /** List entries, applying optional include/exclude/limit/offset filters. */
  async list(options?: FilterOptions): Promise<PgType[]> {
    let sql = `WITH types AS (${typesSql}) SELECT * FROM types WHERE true`

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
    return this.query<PgType>(sql)
  }

  /** Retrieve a single entry by the given filter, or `null` when not found. */
  async retrieve(filter: { id: number }): Promise<PgType | null> {
    const sql = `WITH types AS (${typesSql}) SELECT * FROM types WHERE id = ${escapeLiteral(filter.id)}`
    const rows = await this.query<PgType>(sql)
    return rows[0] ?? null
  }
}
