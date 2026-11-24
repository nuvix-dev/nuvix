/** Row types returned by the metadata resource queries; field names follow PostgreSQL catalog conventions (snake_case). */
/** Server version and connection headroom. */
export interface PgVersion {
  version: string
  version_number: number
  active_connections: number
  max_connections: number
}

/** One row of `pg_settings`. */
export interface PgConfigSetting {
  name: string
  setting: string
  category: string
  group: string
  subgroup: string
  unit: string | null
  short_desc: string
  extra_desc: string | null
  context: string
  vartype: string
  source: string
  min_val: string | null
  max_val: string | null
  enumvals: string[] | null
  boot_val: string
  reset_val: string
  sourcefile: string | null
  sourceline: number | null
  pending_restart: boolean
}

/** A namespace in the database. */
export interface PgSchema {
  id: number
  name: string
  owner: string
}

/** The primary key constraint of a table. */
export interface PgPrimaryKey {
  schema: string
  table_name: string
  name: string
  table_id: number
}

/** A foreign-key edge between two columns. */
export interface PgRelationship {
  id: number
  constraint_name: string
  source_schema: string
  source_table_name: string
  source_column_name: string
  target_table_schema: string
  target_table_name: string
  target_column_name: string
}

/** A base table with RLS state, size estimates, and its keys/relationships. */
export interface PgTable {
  id: number
  schema: string
  name: string
  rls_enabled: boolean
  rls_forced: boolean
  replica_identity: 'DEFAULT' | 'INDEX' | 'FULL' | 'NOTHING'
  bytes: number
  size: string
  live_rows_estimate: number
  dead_rows_estimate: number
  comment: string | null
  primary_keys: PgPrimaryKey[]
  relationships: PgRelationship[]
  columns?: PgColumn[]
}

/** One column of a table, including identity/generated/nullability flags. */
export interface PgColumn {
  table_id: number
  schema: string
  table: string
  id: string
  ordinal_position: number
  name: string
  default_value: string | null
  data_type: string
  format: string
  is_identity: boolean
  identity_generation: 'ALWAYS' | 'BY DEFAULT' | null
  is_generated: boolean
  is_nullable: boolean
  is_updatable: boolean
  is_unique: boolean
  check: string | null
  enums: string[]
  comment: string | null
}

/** One column participating in an index. */
export interface PgIndexAttribute {
  attribute_number: number
  attribute_name: string
  data_type: string
}

/** One index on a table, including its definition and attributes. */
export interface PgIndex {
  id: number
  table_id: number
  schema: string
  number_of_attributes: number
  number_of_key_attributes: number
  is_unique: boolean
  is_primary: boolean
  is_exclusion: boolean
  is_immediate: boolean
  is_clustered: boolean
  is_valid: boolean
  check_xmin: boolean
  is_ready: boolean
  is_live: boolean
  is_replica_identity: boolean
  key_attributes: number[]
  index_predicate: string | null
  comment: string | null
  index_definition: string
  access_method: string
  index_attributes: PgIndexAttribute[]
}

/** One argument of a function signature. */
export interface PgFunctionArg {
  mode: 'in' | 'out' | 'inout' | 'variadic'
  name: string
  type_id: number
  has_default: boolean
}

/** A routine with signature, volatility, and security attributes. */
export interface PgFunction {
  id: number
  schema: string
  name: string
  language: string
  definition: string
  complete_statement: string
  args: PgFunctionArg[]
  argument_types: string
  identity_argument_types: string
  return_type_id: number
  return_type: string
  return_type_relation_id: number | null
  is_set_returning_function: boolean
  behavior: 'IMMUTABLE' | 'STABLE' | 'VOLATILE'
  security_definer: boolean
  config_params: Record<string, string> | null
}

/** A login/role with its privileges and connection limits. */
export interface PgRole {
  id: number
  name: string
  is_superuser: boolean
  can_create_db: boolean
  can_create_role: boolean
  inherit_role: boolean
  can_login: boolean
  is_replication_role: boolean
  can_bypass_rls: boolean
  active_connections: number
  connection_limit: number
  valid_until: string | null
  config: string[] | null
}

/** An available or installed extension. */
export interface PgExtension {
  name: string
  schema: string | null
  default_version: string
  installed_version: string | null
  comment: string | null
}

/** A view and its updatability. */
export interface PgView {
  id: number
  schema: string
  name: string
  is_updatable: boolean
  comment: string | null
}

/** A trigger with its firing mode and backing function. */
export interface PgTrigger {
  id: number
  table_id: number
  enabled_mode: 'DISABLED' | 'ORIGIN' | 'REPLICA' | 'ALWAYS'
  function_args: string[]
  name: string
  table: string
  schema: string
  condition: string | null
  orientation: string
  activation: string
  events: string[]
  function_name: string
  function_schema: string
}

/** A type: enum/composite definitions included. */
export interface PgType {
  id: number
  name: string
  schema: string
  format: string
  enums: string[]
  attributes: Array<{ name: string; type_id: number }>
  comment: string | null
}

/** A row level security policy on a table. */
export interface PgPolicy {
  id: number
  schema: string
  table: string
  table_id: number
  name: string
  action: 'PERMISSIVE' | 'RESTRICTIVE'
  roles: string[]
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL' | null
  definition: string | null
  check: string | null
}

/** Shared list-filtering options for resource queries. */
export interface FilterOptions {
  includeSystemSchemas?: boolean
  includedSchemas?: string[]
  excludedSchemas?: string[]
  limit?: number
  offset?: number
}

/** Table query options; omit `includeColumns` to skip the column scan. */
export interface TableFilterOptions extends FilterOptions {
  includeColumns?: boolean
}

/** Column query options, scoped optionally to one table. */
export interface ColumnFilterOptions extends FilterOptions {
  tableId?: number
  table?: string
  schema?: string
}
