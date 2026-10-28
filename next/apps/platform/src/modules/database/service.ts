/** Coordinates project validation and PostgreSQL introspection through the shared tenant resource pool. */
import { BadRequestError, NotFoundError } from '@nuvix/core/errors'
import type { TenantResourcePool, TenantTarget } from '@nuvix/core/tenants'
import type { Database, Doc } from '@nuvix/db'
import type {
  ColumnFilterOptions,
  FilterOptions,
  IndexFilterOptions,
  PgColumn,
  PgConfigSetting,
  PgExtension,
  PgFunction,
  PgIndex,
  PgMeta,
  PgPolicy,
  PgRole,
  PgSchema,
  PgTable,
  PgTrigger,
  PgType,
  PgVersion,
  PgView,
  PolicyFilterOptions,
  TableFilterOptions,
  TriggerFilterOptions,
} from '@nuvix/pg-meta'
import type { Projects } from '../../types/generated'

/** Exposes `@nuvix/pg-meta` operations and raw SQL without leaking tenant infrastructure to routes. */
export class DatabaseService {
  constructor(
    private readonly db: Database,
    private readonly pool: TenantResourcePool,
  ) {}

  /**
   * Resolve a project's `PgMeta` facade through the shared tenant pool.
   * Fails unless the project exists, is `active`, and has a provisioned
   * tenant target.
   */
  private async getMeta(projectId: string): Promise<PgMeta> {
    const session = this.db.system()
    const project = (await session.getDocument('projects', projectId)) as Doc<Projects>
    if (project.empty()) {
      throw new NotFoundError('Project', { code: 'project_not_found' })
    }

    const status = project.get('status')
    if (status !== 'active') {
      throw new BadRequestError('Project database is not active', {
        code: 'project_not_active',
      })
    }

    const rawTarget = project.get('target') as unknown
    if (!rawTarget) {
      throw new NotFoundError('Project tenant database target', {
        code: 'tenant_target_not_found',
      })
    }

    const target: TenantTarget =
      typeof rawTarget === 'string'
        ? (JSON.parse(rawTarget) as TenantTarget)
        : (rawTarget as TenantTarget)

    // Only the pool turns target metadata into a live resource; callers receive the metadata facade instead.
    const resource = await this.pool.get({ id: projectId, target })
    return resource.meta()
  }

  /** Run one raw SQL statement on the tenant database. */
  async query(projectId: string, sql: string): Promise<unknown[]> {
    if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
      throw new BadRequestError('Query must not be empty', { code: 'empty_query' })
    }
    const meta = await this.getMeta(projectId)
    return meta.query(sql)
  }

  /** List schemas visible to the tenant admin role. */
  async listSchemas(projectId: string, options?: FilterOptions): Promise<PgSchema[]> {
    const meta = await this.getMeta(projectId)
    return meta.schemas.list(options)
  }

  /** Retrieve one schema by name or numeric id. */
  async getSchema(projectId: string, nameOrId: string | number): Promise<PgSchema> {
    const meta = await this.getMeta(projectId)
    const filter =
      typeof nameOrId === 'number' || /^\d+$/.test(String(nameOrId))
        ? { id: Number(nameOrId) }
        : { name: String(nameOrId) }
    const schema = await meta.schemas.retrieve(filter)
    if (!schema) {
      throw new NotFoundError('Schema', { code: 'schema_not_found' })
    }
    return schema
  }

  /** List tables with RLS state and size estimates. */
  async listTables(projectId: string, options?: TableFilterOptions): Promise<PgTable[]> {
    const meta = await this.getMeta(projectId)
    return meta.tables.list(options)
  }

  /** Retrieve one table and optionally include its columns. */
  async getTable(
    projectId: string,
    id: number,
    options?: { includeColumns?: boolean },
  ): Promise<PgTable> {
    const meta = await this.getMeta(projectId)
    const table = await meta.tables.retrieve({
      id,
      includeColumns: options?.includeColumns,
    })
    if (!table) {
      throw new NotFoundError('Table', { code: 'table_not_found' })
    }
    return table
  }

  /** List columns, optionally scoped to one table. */
  async listColumns(projectId: string, options?: ColumnFilterOptions): Promise<PgColumn[]> {
    const meta = await this.getMeta(projectId)
    return meta.columns.list(options)
  }

  /** List indexes. */
  async listIndexes(projectId: string, options?: IndexFilterOptions): Promise<PgIndex[]> {
    const meta = await this.getMeta(projectId)
    return meta.indexes.list(options)
  }

  /** List functions/routines. */
  async listFunctions(projectId: string, options?: FilterOptions): Promise<PgFunction[]> {
    const meta = await this.getMeta(projectId)
    return meta.functions.list(options)
  }

  /** List roles with active connection counts. */
  async listRoles(
    projectId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<PgRole[]> {
    const meta = await this.getMeta(projectId)
    return meta.roles.list(options)
  }

  /** List extensions and their installation state. */
  async listExtensions(
    projectId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<PgExtension[]> {
    const meta = await this.getMeta(projectId)
    return meta.extensions.list(options)
  }

  /** List views (regular and materialized). */
  async listViews(projectId: string, options?: FilterOptions): Promise<PgView[]> {
    const meta = await this.getMeta(projectId)
    return meta.views.list(options)
  }

  /** List triggers. */
  async listTriggers(projectId: string, options?: TriggerFilterOptions): Promise<PgTrigger[]> {
    const meta = await this.getMeta(projectId)
    return meta.triggers.list(options)
  }

  /** List types (enums and composites included). */
  async listTypes(projectId: string, options?: FilterOptions): Promise<PgType[]> {
    const meta = await this.getMeta(projectId)
    return meta.types.list(options)
  }

  /** List row level security policies. */
  async listPolicies(projectId: string, options?: PolicyFilterOptions): Promise<PgPolicy[]> {
    const meta = await this.getMeta(projectId)
    return meta.policies.list(options)
  }

  /** Report tenant server version and connection headroom. */
  async getVersion(projectId: string): Promise<PgVersion> {
    const meta = await this.getMeta(projectId)
    return meta.version.get()
  }

  /** Report tenant server configuration settings. */
  async getConfig(projectId: string): Promise<PgConfigSetting[]> {
    const meta = await this.getMeta(projectId)
    return meta.config.list()
  }
}
