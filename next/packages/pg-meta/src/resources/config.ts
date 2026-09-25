import { configSql } from '../sql/config'
import type { PgConfigSetting } from '../types'

export class PgMetaConfig {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  async list(): Promise<PgConfigSetting[]> {
    return this.query<PgConfigSetting>(configSql)
  }
}
