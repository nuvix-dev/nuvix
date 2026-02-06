import { literal } from 'pg-format'
import { PgMetaException } from '../extra/execption'
import { DEFAULT_SYSTEM_SCHEMAS } from './constants'
import { coalesceRowsToArray, filterByList } from './helpers'
import { columnsSql, viewsSql } from './sql/index'
import { PostgresMetaResult, PostgresView } from './types'

export default class PostgresMetaViews {
  query: (sql: string) => Promise<PostgresMetaResult<any>>

  constructor(query: (sql: string) => Promise<PostgresMetaResult<any>>) {
    this.query = query
  }

  async list(options: {
    includeSystemSchemas?: boolean
    includedSchemas?: string[]
    excludedSchemas?: string[]
    limit?: number
    offset?: number
    includeColumns: false
  }): Promise<PostgresMetaResult<(PostgresView & { columns: never })[]>>
  async list(options?: {
    includeSystemSchemas?: boolean
    includedSchemas?: string[]
    excludedSchemas?: string[]
    limit?: number
    offset?: number
    includeColumns?: boolean
  }): Promise<PostgresMetaResult<(PostgresView & { columns: unknown[] })[]>>
  async list({
    includeSystemSchemas = false,
    includedSchemas,
    excludedSchemas,
    limit,
    offset,
    includeColumns = true,
  }: {
    includeSystemSchemas?: boolean
    includedSchemas?: string[]
    excludedSchemas?: string[]
    limit?: number
    offset?: number
    includeColumns?: boolean
  } = {}): Promise<PostgresMetaResult<PostgresView[]>> {
    let sql = generateEnrichedViewsSql({ includeColumns })
    const filter = filterByList(
      includedSchemas,
      excludedSchemas,
      !includeSystemSchemas ? DEFAULT_SYSTEM_SCHEMAS : undefined,
    )
    if (filter) {
      sql += ` where schema ${filter}`
    }
    if (limit) {
      sql += ` limit ${limit}`
    }
    if (offset) {
      sql += ` offset ${offset}`
    }
    return this.query(sql)
  }

  async retrieve({
    id,
  }: {
    id: number
  }): Promise<PostgresMetaResult<PostgresView>>
  async retrieve({
    name,
    schema,
  }: {
    name: string
    schema: string
  }): Promise<PostgresMetaResult<PostgresView>>
  async retrieve({
    id,
    name,
    schema = 'public',
  }: {
    id?: number
    name?: string
    schema?: string
  }): Promise<PostgresMetaResult<PostgresView>> {
    if (id) {
      const sql = `${generateEnrichedViewsSql({
        includeColumns: true,
      })} where views.id = ${literal(id)};`
      const { data, error } = await this.query(sql)
      if (error) {
        return { data, error }
      }
      if (data.length === 0) {
        throw new PgMetaException(`Cannot find a view with ID ${id}`)
      }
      return { data: data[0], error: null }
    }
    if (name) {
      const sql = `${generateEnrichedViewsSql({
        includeColumns: true,
      })} where views.name = ${literal(name)} and views.schema = ${literal(schema)};`
      const { data, error } = await this.query(sql)
      if (error) {
        return { data, error }
      }
      if (data.length === 0) {
        throw new PgMetaException(
          `Cannot find a view named ${name} in schema ${schema}`,
        )
      }
      return { data: data[0], error: null }
    }
    throw new PgMetaException('Invalid parameters on view retrieve')
  }
}

const generateEnrichedViewsSql = ({
  includeColumns,
}: {
  includeColumns: boolean
}) => `
with views as (${viewsSql})
  ${includeColumns ? `, columns as (${columnsSql})` : ''}
select
  *
  ${includeColumns ? `, ${coalesceRowsToArray('columns', 'columns.table_id = views.id')}` : ''}
from views`
