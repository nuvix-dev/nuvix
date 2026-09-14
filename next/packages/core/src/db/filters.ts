/**
 * Shared `@nuvix/db` filter registry (D38).
 *
 * `@nuvix/db` ships the filter *mechanism* (`Database.addFilter`, applied by
 * name via an attribute's `filters: [...]` array) but no filter
 * implementations — every app that used the legacy Nest stack registered its
 * own `json`/`encrypt`/etc. filters once at bootstrap
 * (`libs/core/src/core.module.ts` → `configureDbFiltersAndFormats`). v2 keeps
 * that same "register once, apply by name everywhere" shape so collection
 * schemas stay declarative instead of each service hand-rolling
 * JSON.stringify/encrypt calls around field access.
 */

import { Database, type Filter } from '@nuvix/db'
import { decryptSecret, encryptSecret } from '../tenants/encryption'

/**
 * Stringifies non-null values on encode, parses them back on decode.
 *
 * `@nuvix/db`'s native `Json` attribute type already stores structured data
 * as-is (no filter needed). This filter exists for the case the native type
 * can't cover: a value that must ALSO pass through another filter that only
 * operates on strings — e.g. `filters: ['json', 'encrypt']` lets a
 * String-typed column hold an encrypted blob of arbitrary JSON.
 */
export const jsonFilter: Filter = {
  encode(value) {
    return value === null || value === undefined ? null : JSON.stringify(value)
  },
  decode(value) {
    if (typeof value !== 'string') return value
    return JSON.parse(value)
  },
}

/**
 * AES-256-GCM at-rest encryption for string-valued attributes (see
 * `../tenants/encryption.ts`). The key is bound at registration time —
 * there is no implicit global key, unlike the legacy Node `Auth.encrypt`
 * helper it replaces.
 */
export function createEncryptFilter(key: Uint8Array): Filter {
  return {
    async encode(value) {
      if (typeof value !== 'string') return null
      return encryptSecret(value, key)
    },
    async decode(value) {
      if (typeof value !== 'string') return value
      return decryptSecret(value, key)
    },
  }
}

const ALREADY_REGISTERED = /already exists/i

/**
 * `Database.addFilter` throws if a name is registered twice in the same
 * process (e.g. two test files, or a dev `--watch` reload, both importing
 * this module). Registration is idempotent from the caller's perspective —
 * only a genuine error propagates.
 */
function registerOnce(name: string, filter: Filter): void {
  try {
    Database.addFilter(name, filter)
  } catch (error) {
    if (error instanceof Error && ALREADY_REGISTERED.test(error.message)) {
      return
    }
    throw error
  }
}

/**
 * Registers the shared `json`/`encrypt` filter pair on `@nuvix/db`'s global
 * filter registry. Call once per process, before constructing any
 * `Database` instance whose schema references either filter by name.
 */
export function registerCoreDbFilters(encryptionKey: Uint8Array): void {
  registerOnce('json', jsonFilter)
  registerOnce('encrypt', createEncryptFilter(encryptionKey))
}
