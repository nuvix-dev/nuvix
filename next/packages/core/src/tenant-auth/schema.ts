import { Cache, Memory } from '@nuvix/cache'
import { Adapter, Database, Doc, Permission, Role } from '@nuvix/db'
import { SQL } from 'bun'
import { registerCoreDbFilters } from '../db/filters'
import type { TenantTarget } from '../tenants/types'
import { authCollections } from './collections'

/** Dedicated Postgres schema for core auth collections — never a user-created schema name. */
export const AUTH_SCHEMA = 'auth'

/**
 * Builds a `Database` bound permanently to the `auth` schema on the given
 * tenant `SQL` connection. A dedicated `Adapter` (not the tenant's default
 * one) is required: schema selection lives on the adapter's mutable meta
 * (`setMeta({ schema })`), and that adapter is shared by every concurrent
 * request against a pooled `TenantResource` — toggling it per-call would
 * race. Binding the schema once, at construction, on an adapter used only
 * for auth data avoids that entirely; the underlying Bun `SQL` connection
 * pool is still shared with the tenant's default adapter (one pool per
 * tenant, per `AGENTS.md`).
 */
export function createAuthDatabase(sql: SQL, cache: Cache): Database {
  registerCoreDbFilters()
  const adapter = new Adapter(sql)
  adapter.setMeta({ schema: AUTH_SCHEMA, namespace: AUTH_SCHEMA })
  return new Database(adapter, cache)
}

/**
 * Creates the `auth` schema and every core collection that doesn't exist
 * yet. Idempotent.
 *
 * **Readiness check is on `@nuvix/db`'s own internal bookkeeping table
 * (`Database.METADATA`, `"_metadata"`), not on the schema's existence.**
 * `nuvix/postgres:18.1` pre-creates a handful of reserved, initially-empty
 * schemas for the platform to use — `auth` among them (alongside `core`,
 * `realtime`, `system`, `vault`) — so the schema already exists before
 * `@nuvix/db` ever touches it. Checking schema existence alone would wrongly
 * conclude the bootstrap already ran and skip `db.create()`, which is the
 * only thing that creates `@nuvix/db`'s own metadata table; every later
 * `createCollection` call would then fail referencing a table that was
 * never created. Checking for the metadata table itself is correct in both
 * cases: a schema `@nuvix/db` created itself, and one the image pre-created.
 */
export async function ensureAuthSchema(db: Database): Promise<void> {
  if (!(await db.exists(undefined, Database.METADATA))) await db.create()

  for (const collection of authCollections) {
    if (await db.exists(undefined, collection.$id)) continue
    const isPrivateCollection = !collection.documentSecurity
    await db.createCollection({
      id: collection.$id,
      attributes: collection.attributes.map((attribute) => new Doc(attribute)),
      indexes: collection.indexes.map((index) => new Doc(index)),
      permissions: isPrivateCollection
        ? [
            Permission.read(Role.any()),
            Permission.create(Role.any()),
            Permission.update(Role.any()),
            Permission.delete(Role.any()),
          ]
        : [Permission.create(Role.any())],
      documentSecurity: collection.documentSecurity,
      enabled: collection.enabled,
    })
  }
}

/**
 * One-shot bootstrap run exactly once, at project-creation time (platform
 * app's `ProjectService`) — NOT lazily on every tenant access. Opens its
 * own short-lived `SQL` connection (this is provisioning-time work, not the
 * request-serving `TenantResourcePool`), ensures the schema, and always
 * closes the connection before returning.
 */
export async function bootstrapAuthSchema(target: TenantTarget): Promise<void> {
  const sql = new SQL({
    hostname: target.host,
    port: target.port,
    database: target.database,
    username: target.user,
    password: target.password,
  })
  try {
    // A one-shot connection has nothing worth caching against Redis — a
    // plain in-memory cache is fine for a bootstrap that runs exactly once.
    await ensureAuthSchema(createAuthDatabase(sql, new Cache(new Memory())))
  } finally {
    await sql.close()
  }
}
