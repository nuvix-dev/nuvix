import { ident, literal } from 'pg-format'
import { TablePrivilegeGrantDTO } from '../DTO/table-privilege-grant.dto'
import { TablePrivilegeRevokeDTO } from '../DTO/table-privilege-revoke.dto'
import { PgMetaException } from '../extra/execption'
import { DEFAULT_SYSTEM_SCHEMAS } from './constants'
import { filterByList } from './helpers'
import { tablePrivilegesSql } from './sql/index'
import { PostgresMetaResult, PostgresTablePrivileges } from './types'

export default class PostgresMetaTablePrivileges {
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
  } = {}): Promise<PostgresMetaResult<PostgresTablePrivileges[]>> {
    let sql = `
with table_privileges as (${tablePrivilegesSql})
select *
from table_privileges
`
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
  }): Promise<PostgresMetaResult<PostgresTablePrivileges>>
  async retrieve({
    name,
    schema,
  }: {
    name: string
    schema: string
  }): Promise<PostgresMetaResult<PostgresTablePrivileges>>
  async retrieve({
    id,
    name,
    schema = 'public',
  }: {
    id?: number
    name?: string
    schema?: string
  }): Promise<PostgresMetaResult<PostgresTablePrivileges>> {
    if (id) {
      const sql = `
with table_privileges as (${tablePrivilegesSql})
select *
from table_privileges
where table_privileges.relation_id = ${literal(id)};`
      const { data, error } = await this.query(sql)
      if (error) {
        return { data, error }
      }
      if (data.length === 0) {
        throw new PgMetaException(`Cannot find a relation with ID ${id}`)
      }
      return { data: data[0], error }
    }
    if (name) {
      const sql = `
with table_privileges as (${tablePrivilegesSql})
select *
from table_privileges
where table_privileges.schema = ${literal(schema)}
  and table_privileges.name = ${literal(name)}
`
      const { data, error } = await this.query(sql)
      if (error) {
        return { data, error }
      }
      if (data.length === 0) {
        throw new PgMetaException(
          `Cannot find a relation named ${name} in schema ${schema}`,
        )
      }
      return { data: data[0], error }
    }
    throw new PgMetaException(
      'Invalid parameters on retrieving table privileges',
    )
  }

  async grant(
    grants: TablePrivilegeGrantDTO[],
  ): Promise<PostgresMetaResult<PostgresTablePrivileges[]>> {
    let sql = `
do $$
begin
${grants
  .map(
    ({ privilege_type, relation_id, grantee, is_grantable }) =>
      `execute format('grant ${privilege_type} on table %s to ${
        grantee.toLowerCase() === 'public' ? 'public' : ident(grantee)
      } ${is_grantable ? 'with grant option' : ''}', ${relation_id}::regclass);`,
  )
  .join('\n')}
end $$;
`
    const { data, error } = await this.query(sql)
    if (error) {
      return { data, error }
    }

    // Return the updated table privileges for modified relations.
    const relationIds = [
      ...new Set(grants.map(({ relation_id }) => relation_id)),
    ]
    sql = `
with table_privileges as (${tablePrivilegesSql})
select *
from table_privileges
where relation_id in (${relationIds.map(literal).join(',')})
`
    return this.query(sql)
  }

  async revoke(
    revokes: TablePrivilegeRevokeDTO[],
  ): Promise<PostgresMetaResult<PostgresTablePrivileges[]>> {
    let sql = `
do $$
begin
${revokes
  .map(
    revoke =>
      `execute format('revoke ${revoke.privilege_type} on table %s from ${revoke.grantee}', ${revoke.relation_id}::regclass);`,
  )
  .join('\n')}
end $$;
`
    const { data, error } = await this.query(sql)
    if (error) {
      return { data, error }
    }

    // Return the updated table privileges for modified relations.
    const relationIds = [
      ...new Set(revokes.map(({ relation_id }) => relation_id)),
    ]
    sql = `
with table_privileges as (${tablePrivilegesSql})
select *
from table_privileges
where relation_id in (${relationIds.map(literal).join(',')})
`
    return this.query(sql)
  }
}
