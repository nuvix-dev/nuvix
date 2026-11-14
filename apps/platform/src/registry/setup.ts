/**
 * Platform database bootstrap.
 *
 * Constructs the `@nuvix/db` instance backing the platform's own control-plane
 * data (currently just `projects`) and ensures its schema exists. PostgreSQL
 * and SQLite are both supported; SQLite is the zero-infrastructure default
 * (`config.platform.dbDriver`).
 *
 * `platformCollections` (see `./collections.ts`) is the same array that feeds
 * `nuvix-db.config.ts`'s type generation, so the schema created here always
 * matches the types the rest of the app compiles against.
 */

import {
  createPlatformDatabase as createDatabase,
  ensurePlatformSchema,
} from '@nuvix/core/platform'
import type { Database } from '@nuvix/db'
import { config } from '@nuvix/utils'

export { ensurePlatformSchema }

/** Builds the platform `Database` and ensures its schema exists. */
export async function createPlatformDatabase(): Promise<Database> {
  return createDatabase({
    driver: config.platform.dbDriver,
    url: config.platform.dbUrl,
    encryptionKey: config.platform.tenantEncryptionKey,
  })
}
