/** PostgreSQL metadata resource: Available PostgreSQL extensions and their installation state. */
import { escapeLiteral } from '../helpers'
import { extensionsSql } from '../sql/extensions'
import type { PgExtension } from '../types'

/** Extension introspection. Filters become WHERE fragments composed around the raw SQL template in `../sql`. */
export class PgMetaExtensions {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  /** List entries, applying optional include/exclude/limit/offset filters. */
  async list(options?: { limit?: number; offset?: number }): Promise<PgExtension[]> {
    let sql = `WITH extensions AS (${extensionsSql}) SELECT * FROM extensions WHERE true`
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`
    }
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`
    }
    return this.query<PgExtension>(sql)
  }

  /** Retrieve a single entry by the given filter, or `null` when not found. */
  async retrieve(filter: { name: string }): Promise<PgExtension | null> {
    const sql = `WITH extensions AS (${extensionsSql}) SELECT * FROM extensions WHERE name = ${escapeLiteral(filter.name)}`
    const rows = await this.query<PgExtension>(sql)
    return rows[0] ?? null
  }
}
