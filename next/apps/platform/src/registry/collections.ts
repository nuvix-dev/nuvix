/**
 * Platform registry collection schemas (D37/D38) — single source of truth.
 *
 * This array is consumed by two independent places, on purpose:
 *  - `nuvix-db.config.ts` (repo root of this app) feeds it to the `nuvix-db`
 *    CLI, which generates `./src/types/generated.ts` — an `Entities`
 *    augmentation of `@nuvix/db` giving every `Session` method (`find`,
 *    `createDocument`, etc.) compile-time-typed documents for `'projects'`
 *    without a manual `Doc<Projects>` generic at each call site.
 *  - `./setup.ts` feeds it to `Database.createCollection` at app boot, so
 *    the schema that generated the types is *exactly* the schema that gets
 *    provisioned — never two definitions to keep in sync by hand.
 *
 * Mirrors the shape legacy used for the same reason
 * (`libs/utils/src/collections/*.ts` → `libs/utils/nuvix-db.config.ts`).
 */

import { AttributeType, Database, ID, type Collection } from '@nuvix/db'

/**
 * One document per provisioned project. Control-plane data only — the
 * platform app is the sole reader/writer (via `db.system()`); there is no
 * per-caller row-level ACL here because access is gated by the platform
 * app's own HTTP auth, not by `@nuvix/db` permissions. Hence empty
 * `permissions` and `documentSecurity: false` on every collection below.
 */
const projects: Collection = {
  $collection: Database.METADATA,
  $id: ID.custom('projects'),
  name: 'Projects',
  documentSecurity: false,
  enabled: true,
  attributes: [
    {
      $id: ID.custom('name'),
      key: 'name',
      type: AttributeType.String,
      size: 128,
      required: true,
    },
    {
      $id: ID.custom('status'),
      key: 'status',
      type: AttributeType.String,
      size: 32,
      required: true,
      default: 'provisioning',
    },
    {
      $id: ID.custom('containerName'),
      key: 'containerName',
      type: AttributeType.String,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('volumeName'),
      key: 'volumeName',
      type: AttributeType.String,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      // Connection coordinates + password for the project's dedicated
      // tenant Postgres container. `@nuvix/db`'s native `Json` attribute
      // type stores structured data as-is (no encryption); the
      // `json`+`encrypt` filter pair (see `@nuvix/core/db`) stringifies
      // then encrypts, so the column never holds a plaintext password.
      $id: ID.custom('target'),
      key: 'target',
      type: AttributeType.String,
      size: 8192,
      required: false,
      default: null,
      filters: ['json', 'encrypt'],
    },
    {
      $id: ID.custom('errorMessage'),
      key: 'errorMessage',
      type: AttributeType.String,
      size: 1024,
      required: false,
      default: null,
    },
  ],
  indexes: [],
}

export const platformCollections: Collection[] = [projects]
