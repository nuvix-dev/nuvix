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

export { platformCollections } from '@nuvix/core/platform'
