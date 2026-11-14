/** PostgreSQL metadata resource: PostgreSQL server configuration settings. */
import { configSql } from '../sql/config'
import type { PgConfigSetting } from '../types'

/** Server configuration settings introspection (pg_settings). Filters become WHERE fragments composed around the raw SQL template in `../sql`. */
export class PgMetaConfig {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  /** List entries, applying optional include/exclude/limit/offset filters. */
  async list(): Promise<PgConfigSetting[]> {
    return this.query<PgConfigSetting>(configSql)
  }
}
