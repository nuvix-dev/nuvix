/**
 * Platform database bootstrap (D20, D37, D38).
 *
 * Constructs the `@nuvix/db` instance backing the platform's own control-plane
 * data (currently just `projects`) and ensures its schema exists. Supports
 * both drivers per `AGENTS.md`'s "Platform persistence supports PostgreSQL or
 * SQLite" rule — SQLite is the zero-infra default (`config.platform.dbDriver`).
 *
 * `platformCollections` (see `./collections.ts`) is the same array that feeds
 * `nuvix-db.config.ts`'s type generation, so the schema created here always
 * matches the types the rest of the app compiles against.
 */

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { Cache, Memory } from '@nuvix/cache'
import { registerCoreDbFilters } from '@nuvix/core/db'
import { decodeEncryptionKey } from '@nuvix/core/tenants'
import { Adapter, Database, Doc, SQLiteAdapter } from '@nuvix/db'
import { config } from '@nuvix/utils'
import { platformCollections } from './collections'

async function createAdapter(): Promise<Adapter | SQLiteAdapter> {
  if (config.platform.dbDriver === 'postgres') {
    return new Adapter(config.platform.dbUrl)
  }

  const file = config.platform.dbUrl
  // Zero-infra local dev (the sqlite default) must not require the operator
  // to pre-create `./data` — `bun:sqlite` fails with SQLITE_CANTOPEN otherwise.
  if (file !== ':memory:') {
    await mkdir(path.dirname(file), { recursive: true })
  }
  return new SQLiteAdapter(file)
}

/**
 * Ensures every collection in `collections.ts` exists on `db`, creating the
 * database itself first if needed. Idempotent (`db.exists` guards both) —
 * safe to call on every process start, and separated from adapter
 * construction so tests can bootstrap an already-open `Database` directly.
 */
export async function ensurePlatformSchema(db: Database): Promise<void> {
  if (!(await db.exists())) {
    await db.create()
  }

  for (const collection of platformCollections) {
    if (await db.exists(undefined, collection.$id)) continue
    await db.createCollection({
      id: collection.$id,
      attributes: collection.attributes.map((attribute) => new Doc(attribute)),
      indexes: collection.indexes.map((index) => new Doc(index)),
      // No per-caller row-level ACL (see collections.ts) — the platform app
      // is the sole reader/writer, always via `db.system()`.
      permissions: [],
      documentSecurity: collection.documentSecurity,
      enabled: collection.enabled,
    })
  }
}

/** Builds the platform `Database` and ensures its schema exists. */
export async function createPlatformDatabase(): Promise<Database> {
  registerCoreDbFilters(decodeEncryptionKey(config.platform.tenantEncryptionKey))

  const db = new Database(await createAdapter(), new Cache(new Memory()))
  await ensurePlatformSchema(db)

  return db
}
