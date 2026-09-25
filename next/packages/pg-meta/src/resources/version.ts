import { versionSql } from '../sql/version'
import type { PgVersion } from '../types'

export class PgMetaVersion {
  constructor(private readonly query: <T = unknown>(sql: string) => Promise<T[]>) {}

  async get(): Promise<PgVersion> {
    const rows = await this.query<PgVersion>(versionSql)
    const result = rows[0]
    if (!result) {
      throw new Error('Failed to retrieve PostgreSQL version')
    }
    return {
      version: result.version,
      version_number: Number(result.version_number),
      active_connections: Number(result.active_connections),
      max_connections: Number(result.max_connections),
    }
  }
}
