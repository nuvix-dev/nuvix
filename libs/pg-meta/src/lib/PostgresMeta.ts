import type { Client } from 'pg'
import * as Parser from './Parser'
import PostgresMetaColumnPrivileges from './PostgresMetaColumnPrivileges'
import PostgresMetaColumns from './PostgresMetaColumns'
import PostgresMetaConfig from './PostgresMetaConfig'
import PostgresMetaExtensions from './PostgresMetaExtensions'
import PostgresMetaForeignTables from './PostgresMetaForeignTables'
import PostgresMetaFunctions from './PostgresMetaFunctions'
import PostgresMetaIndexes from './PostgresMetaIndexes'
import PostgresMetaMaterializedViews from './PostgresMetaMaterializedViews'
import PostgresMetaPolicies from './PostgresMetaPolicies'
import PostgresMetaPublications from './PostgresMetaPublications'
import PostgresMetaRelationships from './PostgresMetaRelationships'
import PostgresMetaRoles from './PostgresMetaRoles'
import PostgresMetaSchemas from './PostgresMetaSchemas'
import PostgresMetaTablePrivileges from './PostgresMetaTablePrivileges'
import PostgresMetaTables from './PostgresMetaTables'
import PostgresMetaTriggers from './PostgresMetaTriggers'
import PostgresMetaTypes from './PostgresMetaTypes'
import PostgresMetaVersion from './PostgresMetaVersion'
import PostgresMetaViews from './PostgresMetaViews'
import { init } from './db'
import { PostgresMetaResult, PoolConfig } from './types'

export default class PostgresMeta {
  query: (
    sql: string,
    trackQueryInSentry?: boolean,
  ) => Promise<PostgresMetaResult<any>>
  end: () => Promise<void>
  client: Client
  columnPrivileges: PostgresMetaColumnPrivileges
  columns: PostgresMetaColumns
  config: PostgresMetaConfig
  extensions: PostgresMetaExtensions
  foreignTables: PostgresMetaForeignTables
  functions: PostgresMetaFunctions
  indexes: PostgresMetaIndexes
  materializedViews: PostgresMetaMaterializedViews
  policies: PostgresMetaPolicies
  publications: PostgresMetaPublications
  relationships: PostgresMetaRelationships
  roles: PostgresMetaRoles
  schemas: PostgresMetaSchemas
  tablePrivileges: PostgresMetaTablePrivileges
  tables: PostgresMetaTables
  triggers: PostgresMetaTriggers
  types: PostgresMetaTypes
  version: PostgresMetaVersion
  views: PostgresMetaViews

  parse = Parser.Parse
  deparse = Parser.Deparse
  format = Parser.Format

  constructor(config: PoolConfig) {
    const { query, end } = init(config)
    this.query = query
    this.end = end
    this.client = config as Client
    this.columnPrivileges = new PostgresMetaColumnPrivileges(this.query)
    this.columns = new PostgresMetaColumns(this.query)
    this.config = new PostgresMetaConfig(this.query)
    this.extensions = new PostgresMetaExtensions(this.query)
    this.foreignTables = new PostgresMetaForeignTables(this.query)
    this.functions = new PostgresMetaFunctions(this.query)
    this.indexes = new PostgresMetaIndexes(this.query)
    this.materializedViews = new PostgresMetaMaterializedViews(this.query)
    this.policies = new PostgresMetaPolicies(this.query)
    this.publications = new PostgresMetaPublications(this.query)
    this.relationships = new PostgresMetaRelationships(this.query)
    this.roles = new PostgresMetaRoles(this.query)
    this.schemas = new PostgresMetaSchemas(this.query)
    this.tablePrivileges = new PostgresMetaTablePrivileges(this.query)
    this.tables = new PostgresMetaTables(this.query)
    this.triggers = new PostgresMetaTriggers(this.query)
    this.types = new PostgresMetaTypes(this.query)
    this.version = new PostgresMetaVersion(this.query)
    this.views = new PostgresMetaViews(this.query)
  }
}
