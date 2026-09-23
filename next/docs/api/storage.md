# v2 Contract — Storage (Buckets & Files)

> Status: PROPOSED — review before implementation
> Depends on: `_conventions.md` (D19, D26–D28), `@nuvix/storage`, `@nuvix/db`
> Old code (reference only): root `apps/server/src/storage/`

Storage module for managing file buckets and file assets within a project's tenant.

## 1. Auth posture

- **Buckets Management**:
  - `POST /v2/storage/buckets`, `PUT /v2/storage/buckets/:bucketId`, `DELETE /v2/storage/buckets/:bucketId` require administrative authorization (`admin`, `owner`, or `x-nuvix-key` API key).
  - `GET /v2/storage/buckets` and `GET /v2/storage/buckets/:bucketId` allow users/guests subject to bucket permissions (`$permissions`).
- **Files Management**:
  - `POST /v2/storage/buckets/:bucketId/files`, `PUT /v2/storage/buckets/:bucketId/files/:fileId`, `DELETE /v2/storage/buckets/:bucketId/files/:fileId` require write permissions.
  - If a bucket has `fileSecurity: true` (default), individual file-level permissions (`$permissions`) are enforced for non-admin callers.
  - If `fileSecurity: false`, any caller authorized for the bucket may read/write files in that bucket.

---

## 2. Bucket Endpoints

### `GET /v2/storage/buckets`

List buckets accessible to caller with pagination and search.

Query parameters:
- `limit`: integer (optional, default: 25, max: 100)
- `offset`: integer (optional, default: 0)
- `search`: string (optional search on bucket name/id)

Response:
```json
{
  "data": [
    {
      "$id": "default",
      "name": "Default Bucket",
      "permissions": ["read(\"any\")"],
      "fileSecurity": true,
      "enabled": true,
      "maximumFileSize": 31457280,
      "allowedFileExtensions": ["jpg", "png", "webp", "pdf"],
      "compression": "none",
      "encryption": false,
      "antivirus": false,
      "$createdAt": "2026-09-23T10:00:00.000Z",
      "$updatedAt": "2026-09-23T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 25,
    "offset": 0
  }
}
```

### `POST /v2/storage/buckets`

Create a new bucket.

Body:
- `bucketId`: string (optional, defaults to `ID.unique()`, or `'unique()'`)
- `name`: string (required, 1-128 chars)
- `permissions`: array of string (optional, defaults to `[]`)
- `fileSecurity`: boolean (optional, default `true`)
- `enabled`: boolean (optional, default `true`)
- `maximumFileSize`: number (optional, default 30MB = `31457280` bytes)
- `allowedFileExtensions`: array of string (optional, default `[]` meaning all extensions allowed)
- `compression`: string (optional, `'none' | 'gzip' | 'zstd'`, default `'none'`)
- `encryption`: boolean (optional, default `false`)
- `antivirus`: boolean (optional, default `false`)

Response: Bucket object (status 200/201).

### `GET /v2/storage/buckets/:bucketId`

Get bucket details by ID.

Response: Bucket object.

### `PUT /v2/storage/buckets/:bucketId`

Update bucket settings.

Body:
- `name`: string (required)
- `permissions`: array of string (optional)
- `fileSecurity`: boolean (optional)
- `enabled`: boolean (optional)
- `maximumFileSize`: number (optional)
- `allowedFileExtensions`: array of string (optional)
- `compression`: string (optional)
- `encryption`: boolean (optional)
- `antivirus`: boolean (optional)

Response: Bucket object.

### `DELETE /v2/storage/buckets/:bucketId`

Delete bucket and cascade delete all files contained in it.

Response: Status 204 No Content.

---

## 3. File Endpoints

### `GET /v2/storage/buckets/:bucketId/files`

List files in bucket.

Query parameters:
- `limit`: integer (optional, default 25, max 100)
- `offset`: integer (optional, default 0)
- `search`: string (optional filename search)

Response:
```json
{
  "data": [
    {
      "$id": "file_123",
      "bucketId": "default",
      "name": "photo.jpg",
      "signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "mimeType": "image/jpeg",
      "sizeOriginal": 102400,
      "chunksTotal": 1,
      "chunksUploaded": 1,
      "permissions": ["read(\"any\")"],
      "$createdAt": "2026-09-23T10:00:00.000Z",
      "$updatedAt": "2026-09-23T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 25,
    "offset": 0
  }
}
```

### `POST /v2/storage/buckets/:bucketId/files`

Upload a file using multipart form-data.

Form fields:
- `fileId`: string (optional, defaults to `ID.unique()`, or `'unique()'`)
- `file`: binary file (`t.File()`, required)
- `permissions`: array of string or JSON string (optional)

Validations:
- Bucket must exist and be enabled.
- File size must not exceed `bucket.maximumFileSize`.
- File extension must match `bucket.allowedFileExtensions` if specified.

Response: File object (status 201/200).

### `GET /v2/storage/buckets/:bucketId/files/:fileId`

Get file metadata.

Response: File object.

### `GET /v2/storage/buckets/:bucketId/files/:fileId/download`

Download file with `Content-Disposition: attachment; filename="..."`.

Response: Binary stream.

### `GET /v2/storage/buckets/:bucketId/files/:fileId/view`

View file inline with `Content-Disposition: inline`.

Response: Binary stream with original `Content-Type`.

### `GET /v2/storage/buckets/:bucketId/files/:fileId/preview`

Get image preview with optional transformations:
- `width`: integer (optional)
- `height`: integer (optional)
- `gravity`: string (optional)
- `quality`: integer (optional, 1-100)
- `borderWidth`: integer (optional)
- `borderColor`: string (optional)
- `borderRadius`: integer (optional)
- `opacity`: number (optional, 0-1)
- `rotation`: integer (optional, -360 to 360)
- `background`: string (optional)
- `output`: `'jpeg' | 'png' | 'webp' | 'avif'` (optional)

Powered by Bun native `Bun.Image` (D21).

### `PUT /v2/storage/buckets/:bucketId/files/:fileId`

Update file metadata (name and/or permissions).

Body:
- `name`: string (optional)
- `permissions`: array of string (optional)

Response: File object.

### `DELETE /v2/storage/buckets/:bucketId/files/:fileId`

Delete a file from the device storage and database.

Response: Status 204 No Content.

---

## 4. Error Codes (RFC 9457)

| Code | Status | Meaning |
| --- | --- | --- |
| `bucket_not_found` | 404 | Bucket does not exist or caller lacks access |
| `bucket_already_exists` | 409 | Bucket ID already taken |
| `bucket_is_disabled` | 400 | Bucket is disabled for writes |
| `bucket_file_size_exceeded` | 400 | Uploaded file size exceeds bucket limit |
| `bucket_file_extension_unsupported` | 400 | File extension is not allowed in this bucket |
| `file_not_found` | 404 | File does not exist or caller lacks access |
| `file_already_exists` | 409 | File ID already taken |
| `storage_device_error` | 500 | Storage backend I/O failure |
| `general_access_forbidden` | 403 | Caller lacks required scope or permission |
