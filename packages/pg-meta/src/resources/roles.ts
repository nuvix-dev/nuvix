/** PostgreSQL metadata resource: Database roles and their privileges. */
import { escapeLiteral } from '../helpers'
import { rolesSql } from '../sql/roles'
import type { PgRole } from '../types'

/** Role introspection. Filters become WHERE fragments composed around the raw SQL template in `../sql`. */
export class PgMetaRoles {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  /** List entries, applying optional include/exclude/limit/offset filters. */
  async list(options?: { limit?: number; offset?: number }): Promise<PgRole[]> {
    let sql = `WITH roles AS (${rolesSql}) SELECT * FROM roles WHERE true`
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`
    }
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`
    }
    return this.query<PgRole>(sql)
  }

  /** Retrieve a single entry by the given filter, or `null` when not found. */
  async retrieve(filter: { id?: number; name?: string }): Promise<PgRole | null> {
    let sql = `WITH roles AS (${rolesSql}) SELECT * FROM roles WHERE true`
    if (filter.id !== undefined) {
      sql += ` AND id = ${escapeLiteral(filter.id)}`
    } else if (filter.name !== undefined) {
      sql += ` AND name = ${escapeLiteral(filter.name)}`
    } else {
      throw new Error('Either id or name must be provided to retrieve role')
    }
    const rows = await this.query<PgRole>(sql)
    return rows[0] ?? null
  }
}
