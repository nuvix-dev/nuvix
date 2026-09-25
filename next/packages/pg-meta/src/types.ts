export interface PgVersion {
  version: string
  version_number: number
  active_connections: number
  max_connections: number
}

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

export interface PgSchema {
  id: number
  name: string
  owner: string
}

export interface PgPrimaryKey {
  schema: string
  table_name: string
  name: string
  table_id: number
}

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

export interface PgIndexAttribute {
  attribute_number: number
  attribute_name: string
  data_type: string
}

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

export interface PgFunctionArg {
  mode: 'in' | 'out' | 'inout' | 'variadic'
  name: string
  type_id: number
  has_default: boolean
}

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

export interface PgExtension {
  name: string
  schema: string | null
  default_version: string
  installed_version: string | null
  comment: string | null
}

export interface PgView {
  id: number
  schema: string
  name: string
  is_updatable: boolean
  comment: string | null
}

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

export interface PgType {
  id: number
  name: string
  schema: string
  format: string
  enums: string[]
  attributes: Array<{ name: string; type_id: number }>
  comment: string | null
}

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

export interface FilterOptions {
  includeSystemSchemas?: boolean
  includedSchemas?: string[]
  excludedSchemas?: string[]
  limit?: number
  offset?: number
}

export interface TableFilterOptions extends FilterOptions {
  includeColumns?: boolean
}

export interface ColumnFilterOptions extends FilterOptions {
  tableId?: number
  table?: string
  schema?: string
}
