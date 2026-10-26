# v2 Contract — Database (Schemas, Collections, Tables)

> Status: IMPLEMENTED — `apps/server/src/database/route.ts` (+ `schemas/`),
> `apps/server/src/schemas/route.ts` (+ `collections/`, `attributes/`,
> `indexes/`, `documents/`, `tables/`)
> Depends on: `_conventions.md` (D19, D26–D28), `@nuvix/db`
> Old code (reference only): root `apps/server/src/database/`

Schema lifecycle plus the document-model and table surfaces over those
schemas: three schema modes (**document**, **managed**, **unmanaged**),
document-model collections/attributes/indexes/documents under
`/v2/schemas/:schemaId`, and PostgREST-compatible table rows + RPC under
`/v2/schemas/:schemaId/tables` and `/v2/public`. The earlier
"collections/documents out of scope" note is obsolete — everything below
shipped.

## Auth posture

Admin-only: the shared tenant context must resolve an admin session or API
key (`isAdmin`/`isAPIUser`); everyone else gets
`403 /errors/forbidden user_forbidden`. Sensitive table-permission and
collection-write routes re-check the same posture inline.

---

## Endpoints — Schemas (`/v2/database`)

| Method | Path                             | Purpose                                                                     |
| ------ | -------------------------------- | --------------------------------------------------------------------------- |
| GET    | `/v2/database/schemas`           | List schemas, optional `?type=` filter (`document \| managed \| unmanaged`) |
| POST   | `/v2/database/schemas`           | Create schema                                                               |
| GET    | `/v2/database/schemas/:schemaId` | Get one schema                                                              |
| PATCH  | `/v2/database/schemas/:schemaId` | Update description                                                          |
| DELETE | `/v2/database/schemas/:schemaId` | Drop schema (+ all tables), `204`                                           |

Schemas are identified by their **name** (the path parameter is the schema
name; no generated IDs — D28 does not apply).

### Schema object

```json
{
  "name": "appdata",
  "description": "Application data",
  "type": "managed"
}
```

| Field         | Type           | Notes                                          |
| ------------- | -------------- | ---------------------------------------------- |
| `name`        | string         | `^[a-z][a-z0-9_]{0,254}$` (same pattern as v1) |
| `description` | string \| null | Optional, max 255 chars                        |
| `type`        | enum           | `document` \| `managed` \| `unmanaged`         |

`GET` list returns the flat server envelope `{ "data": [...], "total": n }`
(no `meta` wrapper — small admin dataset, D27 offset note). System schemas
(reserved names) are always excluded.

### `POST /v2/database/schemas`

Body: `{ name, description?, type }`.

- **managed / unmanaged** — calls `system.create_schema(name, type,
description)`; PostgreSQL DDL triggers handle policy scaffolding for
  managed mode.
- **document** — additionally seeds the metadata collections required by
  `@nuvix/db` inside the new schema; mid-way failure rolls the registry row
  back and surfaces the original error.

Errors: `409 schema_already_exists`, `404 schema_not_found`, `422`
validation (bad name/type).

### `PATCH` / `DELETE`

`PATCH` body `{ description? }` (`null` clears) and returns the updated
schema; `DELETE` returns `204` and drops the schema via
`system.cleanup_schema`. Unknown name → `404 schema_not_found`.

---

## Endpoints — Collections (`/v2/schemas/:schemaId`)

Document-model collections stored in the named schema's metadata.

| Method | Path                                                    | Purpose                                                            |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------ |
| GET    | `/v2/schemas/:schemaId/collections`                     | List collections (`search`, `limit`, `offset`) — `{ total, data }` |
| POST   | `/v2/schemas/:schemaId/collections`                     | Create collection                                                  |
| GET    | `/v2/schemas/:schemaId/collections/:collectionId`       | Get collection                                                     |
| PUT    | `/v2/schemas/:schemaId/collections/:collectionId`       | Update collection                                                  |
| DELETE | `/v2/schemas/:schemaId/collections/:collectionId`       | Delete collection                                                  |
| GET    | `/v2/schemas/:schemaId/collections/:collectionId/usage` | Collection usage stats                                             |

Errors: `409 collection_already_exists`, `409 collection_limit_exceeded`,
`404 collection_not_found`, `403 user_forbidden`.

## Endpoints — Attributes (`/v2/schemas/:schemaId/collections/:collectionId/attributes`)

| Method | Path                        | Purpose                                             |
| ------ | --------------------------- | --------------------------------------------------- |
| GET    | `…/attributes`              | List attributes                                     |
| POST   | `…/attributes/string`       | Create string attribute                             |
| POST   | `…/attributes/email`        | Create email attribute                              |
| POST   | `…/attributes/enum`         | Create enum attribute                               |
| POST   | `…/attributes/ip`           | Create IP attribute                                 |
| POST   | `…/attributes/url`          | Create URL attribute                                |
| POST   | `…/attributes/integer`      | Create integer attribute                            |
| POST   | `…/attributes/float`        | Create float attribute                              |
| POST   | `…/attributes/boolean`      | Create boolean attribute                            |
| POST   | `…/attributes/datetime`     | Create datetime attribute                           |
| POST   | `…/attributes/timestamptz`  | Create timestamptz attribute                        |
| POST   | `…/attributes/relationship` | Create relationship (FK / multi-relation) attribute |
| GET    | `…/attributes/:key`         | Get attribute                                       |
| PATCH  | `…/attributes/:key`         | Update attribute                                    |
| DELETE | `…/attributes/:key`         | Delete attribute                                    |

Errors: `404 attribute_not_found`, `409 attribute_already_exists`,
`404 collection_not_found`, `403 user_forbidden`.

## Endpoints — Indexes (`…/collections/:collectionId/indexes`)

| Method | Path             | Purpose      |
| ------ | ---------------- | ------------ |
| GET    | `…/indexes`      | List indexes |
| POST   | `…/indexes`      | Create index |
| GET    | `…/indexes/:key` | Get index    |
| DELETE | `…/indexes/:key` | Delete index |

Errors: `404 index_not_found`, `409 index_already_exists`.

## Endpoints — Documents (`…/collections/:collectionId/documents`)

| Method | Path                      | Purpose                                      |
| ------ | ------------------------- | -------------------------------------------- |
| GET    | `…/documents`             | List documents                               |
| POST   | `…/documents`             | Create document (duplicate `$id` → conflict) |
| GET    | `…/documents/:documentId` | Get document                                 |
| PATCH  | `…/documents/:documentId` | Update document                              |
| DELETE | `…/documents/:documentId` | Delete document                              |

Errors: `404 document_not_found`, `409 document_already_exists`,
`400 document_invalid_structure`, `400 document_missing_payload`, plus
`401 user_unauthorized` when the caller lacks document-level permission.

## Endpoints — Tables & RPC (`/v2/schemas/:schemaId/tables`, `/v2/public`)

PostgREST-compatible row access over any table in the schema (admin
surface), plus a `/public` mirror that reads/writes tables in the default
`public` schema. Both surfaces expose the same operations:

| Method | Path                                   | Purpose                                                                              |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------ |
| GET    | `…/tables/:tableId`                    | Query rows (`select`, `filter` `col.op.value`, `order` `col.dir`, `limit`, `offset`) |
| GET    | `…/tables/:tableId/count`              | Count rows                                                                           |
| GET    | `…/tables/:tableId/:rowId`             | Get row by ID                                                                        |
| POST   | `…/tables/:tableId`                    | Insert row(s)                                                                        |
| PUT    | `…/tables/:tableId`                    | Upsert row(s)                                                                        |
| PATCH  | `…/tables/:tableId`                    | Update rows (filter required)                                                        |
| PATCH  | `…/tables/:tableId/:rowId`             | Update row by ID                                                                     |
| DELETE | `…/tables/:tableId`                    | Delete rows (filter required)                                                        |
| DELETE | `…/tables/:tableId/:rowId`             | Delete row by ID                                                                     |
| GET    | `…/tables/:tableId/permissions`        | Get table permissions                                                                |
| PUT    | `…/tables/:tableId/permissions`        | Replace table permissions                                                            |
| GET    | `…/tables/:tableId/:rowId/permissions` | Get row permissions                                                                  |
| PUT    | `…/tables/:tableId/:rowId/permissions` | Replace row permissions                                                              |
| POST   | `…/rpc/:functionId`                    | Execute stored function                                                              |
| POST   | `…/fn/:functionId`                     | Alias of `/rpc/:functionId`                                                          |

Prefixes:

- Admin surface: `/v2/schemas/:schemaId/tables/...`, `/v2/schemas/:schemaId/rpc/...`
- Public surface: `/v2/public/tables/...`, `/v2/public/rpc/...` (default
  `public` schema; `schemaId` not in the path)

Errors: `400 table_invalid_identifier`, `400 table_invalid_input`,
`400 table_filter_required` (blanket update/delete without a filter),
`404 table_row_not_found`, `400 permissions_invalid`,
`400 tenant_database_unavailable`, `400 database_error` (surface for
PostgreSQL errors).

---

## v1 → v2 deviations

1. **Envelope**: schema list returns `{ data, total }`; collection list
   returns `{ total, data }` — both replace v1's shapes; documents follow
   the `@nuvix/db` document model instead of v1's collection documents.
2. **Error format**: RFC 9457 problem+json with the stable `code`s above
   (`schema_already_exists`, `schema_not_found`, `collection_*`,
   `attribute_*`, `index_*`, `document_*`, `table_*`).
3. **Tables + RPC are new** in v2: direct PostgREST-style row access,
   permissions management, and stored-procedure execution replace v1's
   database-module proxying.

## Implementation notes

- Services stay pure over `@nuvix/db`/tenant resources; route layers own
  auth posture and query parsing.
- Document-schema creation seeds `@nuvix/db` metadata collections; rollback
  on partial failure keeps the registry consistent.
- Collections/attributes/indexes require admin/API-key posture on every
  mutating route (`403 user_forbidden` otherwise); document reads/writes
  apply document-level permissions on top.
