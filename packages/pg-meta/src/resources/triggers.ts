/** PostgreSQL metadata resource: Triggers and their firing configuration. */
import { escapeLiteral } from '../helpers'
import { triggersSql } from '../sql/triggers'
import type { PgTrigger } from '../types'

export interface TriggerFilterOptions {
  tableId?: number
  limit?: number
  offset?: number
}

/** Trigger introspection. Filters become WHERE fragments composed around the raw SQL template in `../sql`. */
export class PgMetaTriggers {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  /** List entries, applying optional include/exclude/limit/offset filters. */
  async list(options?: TriggerFilterOptions): Promise<PgTrigger[]> {
    let sql = `WITH triggers AS (${triggersSql}) SELECT * FROM triggers WHERE true`
    if (options?.tableId !== undefined) {
      sql += ` AND table_id = ${escapeLiteral(options.tableId)}`
    }
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`
    }
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`
    }
    return this.query<PgTrigger>(sql)
  }

  /** Retrieve a single entry by the given filter, or `null` when not found. */
  async retrieve(filter: { id: number }): Promise<PgTrigger | null> {
    const sql = `WITH triggers AS (${triggersSql}) SELECT * FROM triggers WHERE id = ${escapeLiteral(filter.id)}`
    const rows = await this.query<PgTrigger>(sql)
    return rows[0] ?? null
  }
}
