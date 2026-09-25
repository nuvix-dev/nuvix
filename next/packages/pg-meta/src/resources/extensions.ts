import { escapeLiteral } from '../helpers'
import { extensionsSql } from '../sql/extensions'
import type { PgExtension } from '../types'

export class PgMetaExtensions {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

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

  async retrieve(filter: { name: string }): Promise<PgExtension | null> {
    const sql = `WITH extensions AS (${extensionsSql}) SELECT * FROM extensions WHERE name = ${escapeLiteral(filter.name)}`
    const rows = await this.query<PgExtension>(sql)
    return rows[0] ?? null
  }
}
