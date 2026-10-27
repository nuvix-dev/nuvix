/** One tenant's runtime: pooled SQL connection plus lazily bound database facades. */
import { Adapter, Database, type Session } from '@nuvix/db'
import { createDatabase as createPgDatabase, type DatabaseFacade } from '@nuvix/pg'
import { PgMeta } from '@nuvix/pg-meta'
import { SQL } from 'bun'
import { createAuthDatabase } from '../tenant-auth'
import { createTenantCacheFactory, type TenantCacheFactory } from './cache'
import type { TenantTarget } from './types'

/** Construction-time and composition-time extension points; every hook is optional and injectable. */
export interface TenantResourceDependencies {
  createSql?: (target: TenantTarget) => SQL
  createDatabase?: (sql: SQL, cache: ReturnType<TenantCacheFactory['forTenant']>) => Database
  createAuthDatabase?: (sql: SQL, cache: ReturnType<TenantCacheFactory['forTenant']>) => Database
  createPgDatabase?: (sql: SQL) => DatabaseFacade
  createPgMeta?: (sql: SQL) => PgMeta
  /** Shared across every `TenantResource` a pool constructs — resolved once, not per tenant. */
  cacheFactory?: TenantCacheFactory
  /**
   * Notified whenever this resource constructs a `Database` facade
   * (default schema at construction, `auth`/custom schemas lazily).
   * Composition hooks (stats usage listeners) register here; thrown
   * errors are swallowed — observability wiring must never break the
   * resource.
   */
  onDatabaseCreated?: (tenant: { projectId: string; schema: string; database: Database }) => void
}

/** Default tenant connection: one server-side pool dedicated to this resource. */
function createSql(target: TenantTarget): SQL {
  return new SQL({
    hostname: target.host,
    port: target.port,
    database: target.database,
    username: target.user,
    password: target.password,
  })
}

/** Default document-plane database bound to the given connection and cache. */
function createDatabase(sql: SQL, cache: ReturnType<TenantCacheFactory['forTenant']>): Database {
  return new Database(new Adapter(sql), cache)
}

/** Fallback cache backend when no tenant-wide factory is injected (in-memory). */
const defaultCacheFactory = createTenantCacheFactory()

/**
 * Owns one tenant's connection pool and document-plane database facades.
 * The same Bun `SQL` instance is injected into `@nuvix/db`; because the
 * adapter did not construct it, this resource remains its sole lifecycle
 * owner and closes it exactly once.
 *
 * The `auth` schema (users/sessions/teams/… — `@nuvix/core/tenant-auth`) is
 * bootstrapped exactly once, at project-creation time (the platform app's
 * `ProjectService` calls `bootstrapAuthSchema` directly against the fresh
 * tenant), never lazily here — `authSession` assumes the schema already
 * exists and does no readiness/exists check per call.
 */
export class TenantResource {
  private readonly sql: SQL
  private readonly db: Database
  private authDb?: Database
  private pgDb?: DatabaseFacade
  private pgMeta?: PgMeta
  private readonly schemaDbs = new Map<string, Database>()
  private closePromise?: Promise<void>
  private readonly dependencies: TenantResourceDependencies

  constructor(
    readonly projectId: string,
    target: TenantTarget,
    dependencies: TenantResourceDependencies = {},
  ) {
    this.dependencies = dependencies
    const cacheFactory = dependencies.cacheFactory ?? defaultCacheFactory
    this.sql = (dependencies.createSql ?? createSql)(target)
    this.db = (dependencies.createDatabase ?? createDatabase)(
      this.sql,
      cacheFactory.forTenant(`tenant:${projectId}:default`),
    )
    this.notifyCreated('default', this.db)
  }

  /** Best-effort composition notification (stats listeners et al). */
  private notifyCreated(schema: string, database: Database): void {
    try {
      this.dependencies.onDatabaseCreated?.({
        projectId: this.projectId,
        schema,
        database,
      })
    } catch {
      // Observability wiring must never break the resource.
    }
  }

  /** Returns the underlying Bun SQL instance for raw tenant DDL/maintenance. */
  getSql(): SQL {
    return this.sql
  }

  /**
   * Returns the @nuvix/pg query builder facade sharing this resource's
   * underlying Bun SQL client.
   */
  pg(): DatabaseFacade {
    this.pgDb ??= (this.dependencies.createPgDatabase ?? createPgDatabase)(this.sql)
    return this.pgDb
  }

  /**
   * Returns the @nuvix/pg-meta introspection facade sharing this resource's
   * underlying Bun SQL client.
   */
  meta(): PgMeta {
    this.pgMeta ??= (this.dependencies.createPgMeta ?? ((sql: SQL) => new PgMeta(sql)))(this.sql)
    return this.pgMeta
  }

  /** Creates a caller-scoped document session without exposing `Database.system()`. */
  session(roles: readonly string[]): Session {
    return this.db.for([...roles])
  }

  /**
   * Returns a Database instance bound to the specified Postgres schema.
   */
  databaseForSchema(schema?: string): Database {
    if (!schema || schema === 'public' || schema === 'default') {
      return this.db
    }
    if (schema === 'auth') {
      const cacheFactory = this.dependencies.cacheFactory ?? defaultCacheFactory
      if (!this.authDb) {
        this.authDb = (this.dependencies.createAuthDatabase ?? createAuthDatabase)(
          this.sql,
          cacheFactory.forTenant(`tenant:${this.projectId}:auth`),
        )
        this.notifyCreated('auth', this.authDb)
      }
      return this.authDb
    }
    let schemaDb = this.schemaDbs.get(schema)
    if (!schemaDb) {
      const cacheFactory = this.dependencies.cacheFactory ?? defaultCacheFactory
      const adapter = new Adapter(this.sql)
      adapter.setMeta({ schema, namespace: schema })
      schemaDb = (this.dependencies.createDatabase ?? createDatabase)(
        this.sql,
        cacheFactory.forTenant(`tenant:${this.projectId}:${schema}`),
      )
      this.schemaDbs.set(schema, schemaDb)
      this.notifyCreated(schema, schemaDb)
    }
    return schemaDb
  }

  /**
   * Caller-scoped session for a specific schema.
   */
  sessionForSchema(schema: string, roles: readonly string[]): Session {
    return this.databaseForSchema(schema).for([...roles])
  }

  /**
   * Privileged system session for a specific schema.
   */
  systemSessionForSchema(schema: string): Session {
    return this.databaseForSchema(schema).system()
  }

  /**
   * Caller-scoped session over the dedicated `auth` schema. Bound on a
   * second `Adapter` sharing this resource's one `SQL` pool (schema
   * selection lives on mutable adapter state, so a second, dedicated
   * adapter avoids racing the default schema against concurrent requests —
   * see `tenant-auth/schema.ts`). Constructing it is a cheap, I/O-free
   * object creation, cached after the first call — no per-call schema
   * check, since provisioning already guaranteed it exists.
   */
  authSession(roles: readonly string[]): Session {
    const cacheFactory = this.dependencies.cacheFactory ?? defaultCacheFactory
    if (!this.authDb) {
      this.authDb = (this.dependencies.createAuthDatabase ?? createAuthDatabase)(
        this.sql,
        cacheFactory.forTenant(`tenant:${this.projectId}:auth`),
      )
      this.notifyCreated('auth', this.authDb)
    }
    return this.authDb.for([...roles])
  }

  /** Privileged system session over the default schema, for system/admin maintenance. */
  systemSession(): Session {
    return this.db.system()
  }

  /** Privileged system session over the dedicated auth schema, for internal lookup/verification. */
  authSystemSession(): Session {
    const cacheFactory = this.dependencies.cacheFactory ?? defaultCacheFactory
    if (!this.authDb) {
      this.authDb = (this.dependencies.createAuthDatabase ?? createAuthDatabase)(
        this.sql,
        cacheFactory.forTenant(`tenant:${this.projectId}:auth`),
      )
      this.notifyCreated('auth', this.authDb)
    }
    return this.authDb.system()
  }

  /** Close the tenant's SQL pool exactly once, from any call site. */
  close(): Promise<void> {
    this.closePromise ??= this.sql.close()
    return this.closePromise
  }
}
