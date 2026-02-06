import { literal } from 'pg-format'
import { PgMetaException } from '../extra/execption'
import { DEFAULT_SYSTEM_SCHEMAS } from './constants'
import { filterByList } from './helpers'
import { indexesSql } from './sql/index'
import { PostgresIndex, PostgresMetaResult } from './types'

export default class PostgresMetaFunctions {
  query: (sql: string) => Promise<PostgresMetaResult<any>>

  constructor(query: (sql: string) => Promise<PostgresMetaResult<any>>) {
    this.query = query
  }

  async list({
    includeSystemSchemas = false,
    includedSchemas,
    excludedSchemas,
    limit,
    offset,
  }: {
    includeSystemSchemas?: boolean
    includedSchemas?: string[]
    excludedSchemas?: string[]
    limit?: number
    offset?: number
  } = {}): Promise<PostgresMetaResult<PostgresIndex[]>> {
    let sql = enrichedSql
    const filter = filterByList(
      includedSchemas,
      excludedSchemas,
      !includeSystemSchemas ? DEFAULT_SYSTEM_SCHEMAS : undefined,
    )
    if (filter) {
      sql += ` WHERE schema ${filter}`
    }
    if (limit) {
      sql = `${sql} LIMIT ${limit}`
    }
    if (offset) {
      sql = `${sql} OFFSET ${offset}`
    }
    return this.query(sql)
  }

  async retrieve({
    id,
  }: {
    id: number
  }): Promise<PostgresMetaResult<PostgresIndex>>
  async retrieve({
    name,
    schema,
    args,
  }: {
    name: string
    schema: string
    args: string[]
  }): Promise<PostgresMetaResult<PostgresIndex>>
  async retrieve({
    id,
    args = [],
  }: {
    id?: number
    args?: string[]
  }): Promise<PostgresMetaResult<PostgresIndex>> {
    if (id) {
      const sql = `${enrichedSql} WHERE id = ${literal(id)};`
      const { data, error } = await this.query(sql)
      if (error) {
        return { data, error }
      }
      if (data.length === 0) {
        throw new PgMetaException(`Cannot find a index with ID ${id}`)
      }
      return { data: data[0], error }
    }
    throw new PgMetaException('Invalid parameters on function retrieve')
  }
}

const enrichedSql = `
  WITH x AS (
    ${indexesSql}
  )
  SELECT
    x.*
  FROM x
`
