# v2 Contract — Storage

> Status: IMPLEMENTED — `apps/server/src/storage/{route,formatter}.ts` +
> `buckets|files|usage/{routes,service}.ts`; usage readers in
> `apps/server/src/stats/usage.ts`
> Depends on: `_conventions.md` (D19, D26–D28), `docs/architecture/integrations.md`
> Old code (reference only): root `apps/server/src/storage/`

Buckets, file upload/download, image previews, push-notification assets, and
usage stats. All routes mount under `/v2/storage`. Storage device is
`@nuvix/storage`'s `Local` driver over `config.storage.uploadsDir`; image
transforms use native `Bun.Image` (no `sharp`).

## v1 → v2 redesigns

| Concern            | v1                                                                                      | v2                                                                              |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| File storage model | one collection **per bucket**                                                           | single `files` collection, `bucketId` attribute                                 |
| Chunked uploads    | same header protocol                                                                    | same `Content-Range` + `x-nuvix-id` protocol, hardened validation               |
| Push assets        | JWT signed at create **without** `projectId` claim — every vendor fetch failed (v1 bug) | JWT signed at delivery with `projectId`/`bucketId`/`fileId`, all three verified |
| Usage stats        | live counts; service default `'1d'` not a config key (latent crash)                     | reads recorded `stats` rows; ranges `24h/7d/30d/90d`, default `'30d'`           |

## Pagination divergence

List endpoints return the service result `{ total, <resources> }` directly —
the `_conventions.md` §4 `{ data, meta }` wrapper is not applied at the route
layer yet. Query surface is `search`, `limit`, `offset`, `cursor`.

---

## Endpoints — Buckets

| Method | Path                                  | Purpose               |
| ------ | ------------------------------------- | --------------------- |
| GET    | `/v2/storage/buckets`                 | List buckets          |
| POST   | `/v2/storage/buckets`                 | Create bucket         |
| GET    | `/v2/storage/buckets/:bucketId`       | Get bucket            |
| PUT    | `/v2/storage/buckets/:bucketId`       | Update bucket         |
| DELETE | `/v2/storage/buckets/:bucketId`       | Delete bucket + files |
| GET    | `/v2/storage/buckets/:bucketId/usage` | Bucket usage stats    |

### Bucket object

```json
{
  "$id": "bucket_avatars",
  "$createdAt": "2026-08-26T04:30:10.000Z",
  "$updatedAt": "2026-08-26T04:30:10.000Z",
  "$permissions": ["read(\"users\")"],
  "fileSecurity": false,
  "name": "Avatars",
  "enabled": true,
  "maximumFileSize": 30000000,
  "allowedFileExtensions": ["png", "jpg"],
  "compression": "none",
  "encryption": false,
  "antivirus": false
}
```

### `POST /v2/storage/buckets`

Body: `{ bucketId?, name, permissions?, fileSecurity?, enabled?, maximumFileSize?, allowedFileExtensions?, compression?, encryption?, antivirus? }`.

| Field                   | Type     | Default      | Notes                                                                        |
| ----------------------- | -------- | ------------ | ---------------------------------------------------------------------------- |
| `bucketId`              | string   | `'unique()'` | D28 create-id convention; `KeyValidator`-checked → else `400 invalid_params` |
| `name`                  | string   | —            | required, 1–128 chars                                                        |
| `permissions`           | string[] | `[]`         | aggregated permission strings                                                |
| `fileSecurity`          | boolean  | `false`      | enables per-file permission checks                                           |
| `enabled`               | boolean  | `true`       | disabled buckets are hidden from non-API callers                             |
| `maximumFileSize`       | number   | `30000000`   | bytes (30 MB)                                                                |
| `allowedFileExtensions` | string[] | `[]`         | empty = all extensions allowed                                               |
| `compression`           | string   | `'none'`     | `none` \| `gzip` \| `zstd`                                                   |
| `encryption`            | boolean  | `false`      | at rest                                                                      |
| `antivirus`             | boolean  | `false`      | scan before storage                                                          |

Duplicate `bucketId` → `409 storage_bucket_already_exists`. The device
directory is created best-effort (pre-existing is fine).

### `PUT /v2/storage/buckets/:bucketId`

Same fields minus `bucketId`, all optional — omitted fields keep current
values. `permissions` replaces the set when provided (omitted keeps existing).

### `DELETE /v2/storage/buckets/:bucketId`

Deletes all `files` rows for the bucket (single-collection model), best-effort
device cleanup, then the bucket. Returns `{ "status": "ok" }`.

## Endpoints — Files

| Method | Path                                                   | Purpose                       |
| ------ | ------------------------------------------------------ | ----------------------------- |
| GET    | `/v2/storage/buckets/:bucketId/files`                  | List files                    |
| POST   | `/v2/storage/buckets/:bucketId/files`                  | Upload file (multipart)       |
| GET    | `/v2/storage/buckets/:bucketId/files/:fileId`          | Get file metadata             |
| GET    | `/v2/storage/buckets/:bucketId/files/:fileId/preview`  | Image preview/transform       |
| GET    | `/v2/storage/buckets/:bucketId/files/:fileId/download` | Download (attachment)         |
| GET    | `/v2/storage/buckets/:bucketId/files/:fileId/view`     | View inline                   |
| GET    | `/v2/storage/buckets/:bucketId/files/:fileId/push`     | Push-notification asset (JWT) |
| PUT    | `/v2/storage/buckets/:bucketId/files/:fileId`          | Update name/permissions       |
| DELETE | `/v2/storage/buckets/:bucketId/files/:fileId`          | Delete file                   |

### File object

```json
{
  "$id": "file_abc123",
  "$createdAt": "2026-08-26T04:30:10.000Z",
  "$updatedAt": "2026-08-26T04:30:10.000Z",
  "$permissions": ["read(\"user:user_001\")"],
  "bucketId": "bucket_avatars",
  "name": "logo.png",
  "signature": "sha256…",
  "mimeType": "image/png",
  "sizeOriginal": 20480,
  "sizeActual": 20480,
  "chunksTotal": 1,
  "chunksUploaded": 1
}
```

### Access model (files routes)

- Bucket `permissions` gate each operation by action (`read`/`create`/`update`/
  `delete`): caller roles must intersect the bucket's permission roles → else
  `401 user_unauthorized`.
- `fileSecurity: true` additionally consults per-file `$permissions` for
  read/update/delete (doc-level session switching).
- API-key/admin callers bypass the disabled-bucket mask; for everyone else a
  disabled bucket reads as `404 storage_bucket_not_found`.
- File reads/writes run on the tenant auth-system session; user-scoped reads
  apply only under `fileSecurity`.

### `POST /v2/storage/buckets/:bucketId/files` — upload

Multipart body: `{ fileId?, permissions?, file }` (`file` is a `t.File`).
Headers: `Content-Range` (opts into chunked upload) and `x-nuvix-id`
(continuation id, required from the second chunk on; replaces the body
`fileId`). `permissions` may only carry `read`/`update`/`delete`; when omitted,
the uploading user gets `read`/`update`/`delete` on the file (empty for
anonymous uploads).

Chunked flow (`Content-Range: bytes <start>-<end>/<total>`):

1. First chunk creates the file doc (`chunksTotal` computed from range
   geometry, `chunksUploaded` tracked in metadata).
2. Each chunk is validated: size/alignment/count consistency, no duplicate
   chunk, total size vs. declared. All violations →
   `400 storage_invalid_content_range`; bad `x-nuvix-id` → `400 invalid_params`;
   duplicate chunk or already-complete upload → `409 storage_file_already_exists`;
   chunk > 1 without an existing upload session → `404 storage_file_not_found`.
3. Final chunk assembles, hashes (`signature`), and finalizes the doc.

Common validations (single and chunked): zero-byte file →
`400 storage_file_empty`; extension not in the bucket allow-list →
`400 storage_file_type_unsupported`; size over `maximumFileSize` →
`400 storage_invalid_file_size`.

### `GET …/files/:fileId/preview`

| Param          | Type   | Notes                                                                  |
| -------------- | ------ | ---------------------------------------------------------------------- |
| `width`        | int    | resize (fit `inside` when both dims given)                             |
| `height`       | int    | aspect-preserving when given alone                                     |
| `gravity`      | string | crop gravity alignment (accepted, not applied yet)                     |
| `quality`      | int    | 1–100, applies to webp/avif/heic/jpeg encoders                         |
| `borderWidth`  | int    | accepted, not applied yet                                              |
| `borderColor`  | string | accepted, not applied yet                                              |
| `borderRadius` | int    | accepted, not applied yet                                              |
| `opacity`      | float  | 0.0–1.0 → brightness modulate                                          |
| `rotation`     | int    | clockwise degrees                                                      |
| `background`   | string | accepted, not applied yet                                              |
| `output`       | string | `jpg` \| `png` \| `webp` \| `avif` \| `heic` (default: source subtype) |

Non-image or >10 MB files bypass transformation and return the raw bytes as
`image/png`. Response: `Content-Disposition: inline`,
`Cache-Control: public, max-age=86400`.

### `GET …/files/:fileId/download` and `…/view`

`download` sends `attachment` disposition, `view` sends `inline`. Both honor a
`Range: bytes=…` request header → `206` with `Content-Range` /
`Accept-Ranges` / sliced `Content-Length`; invalid range →
`400 storage_invalid_range`. Successful responses carry
`Expires` = now + 45 days.

### `GET …/files/:fileId/push` — JWT-gated push asset

Query: `jwt` (required, signed push-asset token). Range header supported.

- Entitlement is **only** the JWT — bucket permissions are not consulted. The
  token must verify and carry matching `projectId`, `bucketId`, `fileId`
  claims → else `401 user_unauthorized`.
- Disabled buckets stay hidden (`404 storage_bucket_not_found`).
- The messaging worker signs a 15-day JWT pointing here when delivering push
  messages whose `image` is a `bucketId:fileId` ref; push vendors fetch this
  URL without caller credentials. Base URL from `NUVIX_ENDPOINT`.

### `PUT …/files/:fileId` and `DELETE …/files/:fileId`

Update body: `{ name?, permissions? }` (permissions restricted to
`read`/`update`/`delete`; omitted keeps existing). Delete removes the device
object (aborting an in-flight chunked upload instead when
`chunksTotal ≠ chunksUploaded`) and the doc. Device/DB failures →
`400 general_server_error`.

## Endpoints — Usage

| Method | Path                                  | Purpose            |
| ------ | ------------------------------------- | ------------------ |
| GET    | `/v2/storage/usage`                   | Project-wide stats |
| GET    | `/v2/storage/buckets/:bucketId/usage` | Per-bucket stats   |

Both accept `?range=24h|7d|30d|90d` (default `30d`); anything else →
`400 invalid_usage_range`.

Reads are **stats-backed** (v1 parity): INF rows carry running totals and
1h/1d period rows carry the series, zero-filled across the window — not live
counts. Per-bucket metrics are recorded under the
`{bucketInternalId}.files[.storage]` keys.

```json
{
  "range": "30d",
  "bucketsTotal": 4,
  "filesTotal": 512,
  "filesStorageTotal": 104857600,
  "buckets": [{ "value": 3, "date": "2026-08-01" }],
  "files": [{ "value": 500, "date": "2026-08-01" }],
  "storage": [{ "value": 104857600, "date": "2026-08-01" }]
}
```

Bucket usage shape: `{ range, filesTotal, filesStorageTotal, files[], storage[] }`.
`24h` buckets are hourly (`date` = hour bucket); `7d/30d/90d` are daily.

---

## Errors

All non-2xx responses are RFC 9457 problem+json (`_conventions.md` §3).
Param/body schema violations are Elysia's built-in `422` with `errors[]`.

| Status | Type                   | Code                            | Trigger                                                             |
| ------ | ---------------------- | ------------------------------- | ------------------------------------------------------------------- |
| 400    | `/errors/bad-request`  | `invalid_params`                | malformed `bucketId` / `x-nuvix-id`                                 |
| 409    | `/errors/conflict`     | `storage_bucket_already_exists` | duplicate `bucketId`                                                |
| 404    | `/errors/not-found`    | `storage_bucket_not_found`      | unknown or (for non-API callers) disabled bucket                    |
| 401    | `/errors/unauthorized` | `user_unauthorized`             | caller roles fail bucket/file permission gate, or push JWT mismatch |
| 400    | `/errors/bad-request`  | `storage_file_empty`            | zero-byte upload                                                    |
| 400    | `/errors/bad-request`  | `storage_invalid_content_range` | any chunked-upload geometry/consistency violation                   |
| 400    | `/errors/bad-request`  | `storage_file_type_unsupported` | extension not in bucket allow-list                                  |
| 400    | `/errors/bad-request`  | `storage_invalid_file_size`     | upload over `maximumFileSize`                                       |
| 409    | `/errors/conflict`     | `storage_file_already_exists`   | duplicate chunk / upload already complete                           |
| 404    | `/errors/not-found`    | `storage_file_not_found`        | unknown file, or chunk > 1 with no upload session                   |
| 400    | `/errors/bad-request`  | `storage_invalid_range`         | malformed/unbounded `Range` header                                  |
| 400    | `/errors/bad-request`  | `general_server_error`          | device write/delete/DB failure                                      |
| 400    | `/errors/bad-request`  | `invalid_usage_range`           | `range` outside `24h/7d/30d/90d`                                    |

## Implementation notes

- Vertical slices: `buckets/`, `files/`, `usage/` each with `routes.ts` +
  `service.ts`; shared views in `formatter.ts` (D15/D16).
- Files services take `(session, systemSession, device)` — the system session
  comes from `tenantResource.authSystemSession()`; user-scoped access applies
  only when `fileSecurity` is on and the caller lacks bucket-level roles.
- Bucket metrics require `bucketInternalId` on file docs, which is why the
  single `files` collection still stores it alongside `bucketId`.
- Usage reads share `stats/usage.ts` (`parseUsageRange`, `readUsageSeries`)
  with the users module; the stats pipeline itself is documented in
  `MIGRATION.md` (Phase 6 follow-through).
