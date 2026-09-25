import type { SQL } from 'bun'
import { PgMetaColumns } from './resources/columns'
import { PgMetaConfig } from './resources/config'
import { PgMetaExtensions } from './resources/extensions'
import { PgMetaFunctions } from './resources/functions'
import { PgMetaIndexes } from './resources/indexes'
import { PgMetaPolicies } from './resources/policies'
import { PgMetaRoles } from './resources/roles'
import { PgMetaSchemas } from './resources/schemas'
import { PgMetaTables } from './resources/tables'
import { PgMetaTriggers } from './resources/triggers'
import { PgMetaTypes } from './resources/types'
import { PgMetaVersion } from './resources/version'
import { PgMetaViews } from './resources/views'

export class PgMeta {
  readonly schemas: PgMetaSchemas
  readonly tables: PgMetaTables
  readonly columns: PgMetaColumns
  readonly indexes: PgMetaIndexes
  readonly functions: PgMetaFunctions
  readonly roles: PgMetaRoles
  readonly extensions: PgMetaExtensions
  readonly views: PgMetaViews
  readonly triggers: PgMetaTriggers
  readonly types: PgMetaTypes
  readonly policies: PgMetaPolicies
  readonly version: PgMetaVersion
  readonly config: PgMetaConfig

  constructor(readonly sql: SQL) {
    const runQuery = <T = unknown>(queryText: string): Promise<T[]> => {
      return this.sql.unsafe<T[]>(queryText)
    }

    this.schemas = new PgMetaSchemas(runQuery)
    this.tables = new PgMetaTables(runQuery)
    this.columns = new PgMetaColumns(runQuery)
    this.indexes = new PgMetaIndexes(runQuery)
    this.functions = new PgMetaFunctions(runQuery)
    this.roles = new PgMetaRoles(runQuery)
    this.extensions = new PgMetaExtensions(runQuery)
    this.views = new PgMetaViews(runQuery)
    this.triggers = new PgMetaTriggers(runQuery)
    this.types = new PgMetaTypes(runQuery)
    this.policies = new PgMetaPolicies(runQuery)
    this.version = new PgMetaVersion(runQuery)
    this.config = new PgMetaConfig(runQuery)
  }

  query<T = unknown>(sqlText: string): Promise<T[]> {
    return this.sql.unsafe<T[]>(sqlText)
  }
}
