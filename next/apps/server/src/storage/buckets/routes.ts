import { Query, type Session } from '@nuvix/db'
import { Local } from '@nuvix/storage'
import { config } from '@nuvix/utils'
import { Elysia, t } from 'elysia'
import { StorageService } from './service'

export const storageBucketsRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))

    // 1. List buckets
    .get(
      '/buckets',
      {
        detail: {
          summary: 'List storage buckets',
          description:
            'Retrieve a paginated list of storage buckets in the project with optional search and cursor pagination.',
          tags: ['Storage Buckets'],
        },
        query: t.Optional(
          t.Object({
            search: t.Optional(
              t.String({
                description: 'Search string to filter buckets by name or ID',
              }),
            ),
            limit: t.Optional(
              t.String({
                description: 'Maximum number of buckets to return',
                pattern: '^[0-9]+$',
              }),
            ),
            offset: t.Optional(
              t.String({
                description: 'Number of buckets to skip before returning results',
                pattern: '^[0-9]+$',
              }),
            ),
            cursor: t.Optional(
              t.String({
                description: 'Pagination cursor token for subsequent page',
              }),
            ),
          }),
        ),
      },
      async ({ db, query }) => {
        const service = new StorageService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        if (query?.cursor) queries.push(Query.cursorAfter(query.cursor))
        return service.getBuckets(queries, query?.search)
      },
    )

    // 2. Create bucket
    .post(
      '/buckets',
      {
        detail: {
          summary: 'Create storage bucket',
          description:
            'Create a new storage bucket with security, size, compression, and permission policies.',
          tags: ['Storage Buckets'],
        },
        body: t.Object({
          bucketId: t.Optional(
            t.String({
              description: 'Custom unique bucket identifier. If omitted, a unique ID is generated.',
            }),
          ),
          name: t.String({
            description: 'Descriptive human-readable bucket name',
            minLength: 1,
            maxLength: 128,
          }),
          permissions: t.Optional(
            t.Array(
              t.String({
                description: 'Permission string specifying role and action access rule',
              }),
              {
                description: 'List of default access permissions for the bucket',
              },
            ),
          ),
          fileSecurity: t.Optional(
            t.Boolean({
              description:
                'Whether file security rules and permissions apply to files in this bucket',
              default: false,
            }),
          ),
          enabled: t.Optional(
            t.Boolean({
              description: 'Whether the bucket is enabled for read and write operations',
              default: true,
            }),
          ),
          maximumFileSize: t.Optional(
            t.Number({
              description: 'Maximum permitted file upload size in bytes (default 30MB)',
              default: 30_000_000,
            }),
          ),
          allowedFileExtensions: t.Optional(
            t.Array(
              t.String({
                description: 'Permitted file extension (e.g. png, jpg, pdf)',
              }),
              {
                description:
                  'Allowed file extension whitelist. Empty means all extensions allowed.',
              },
            ),
          ),
          compression: t.Optional(
            t.String({
              description: 'Compression algorithm applied to files (none, gzip, zstd)',
              default: 'none',
            }),
          ),
          encryption: t.Optional(
            t.Boolean({
              description: 'Whether files stored in this bucket are encrypted at rest',
              default: false,
            }),
          ),
          antivirus: t.Optional(
            t.Boolean({
              description: 'Whether files are scanned by antivirus before storage',
              default: false,
            }),
          ),
        }),
      },
      async ({ db, body }) => {
        const service = new StorageService(db, new Local(config.storage.uploadsDir))
        return service.createBucket(body)
      },
    )

    // 3. Get bucket by ID
    .get(
      '/buckets/:bucketId',
      {
        detail: {
          summary: 'Get bucket by ID',
          description: 'Retrieve configuration details and access policies for a specific bucket.',
          tags: ['Storage Buckets'],
        },
        params: t.Object({
          bucketId: t.String({ description: 'Unique bucket identifier' }),
        }),
      },
      async ({ db, params: { bucketId } }) => {
        const service = new StorageService(db)
        return service.getBucket(bucketId)
      },
    )

    // 4. Update bucket
    .put(
      '/buckets/:bucketId',
      {
        detail: {
          summary: 'Update storage bucket',
          description:
            'Update configuration, allowed extensions, permissions, or security flags of an existing bucket.',
          tags: ['Storage Buckets'],
        },
        params: t.Object({
          bucketId: t.String({ description: 'Unique bucket identifier' }),
        }),
        body: t.Object({
          name: t.Optional(
            t.String({
              description: 'Updated bucket display name',
            }),
          ),
          permissions: t.Optional(
            t.Array(
              t.String({
                description: 'Permission string',
              }),
              {
                description: 'Updated default access permissions list',
              },
            ),
          ),
          fileSecurity: t.Optional(
            t.Boolean({
              description: 'Whether file-level security is enforced',
            }),
          ),
          enabled: t.Optional(
            t.Boolean({
              description: 'Enable or disable bucket',
            }),
          ),
          maximumFileSize: t.Optional(
            t.Number({
              description: 'Updated maximum upload file size in bytes',
            }),
          ),
          allowedFileExtensions: t.Optional(
            t.Array(
              t.String({
                description: 'File extension',
              }),
              {
                description: 'Updated allowed file extensions whitelist',
              },
            ),
          ),
          compression: t.Optional(
            t.String({
              description: 'Updated compression algorithm',
            }),
          ),
          encryption: t.Optional(
            t.Boolean({
              description: 'Enable or disable encryption at rest',
            }),
          ),
          antivirus: t.Optional(
            t.Boolean({
              description: 'Enable or disable antivirus scanning',
            }),
          ),
        }),
      },
      async ({ db, params: { bucketId }, body }) => {
        const service = new StorageService(db)
        return service.updateBucket(bucketId, body)
      },
    )

    // 5. Delete bucket
    .delete(
      '/buckets/:bucketId',
      {
        detail: {
          summary: 'Delete storage bucket',
          description:
            'Permanently delete a storage bucket along with all contained files and storage resources.',
          tags: ['Storage Buckets'],
        },
        params: t.Object({
          bucketId: t.String({ description: 'Unique bucket identifier' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Status confirmation string' }),
          }),
        },
      },
      async ({ db, params: { bucketId } }) => {
        const service = new StorageService(db, new Local(config.storage.uploadsDir))
        await service.deleteBucket(bucketId)
        return { status: 'ok' as const }
      },
    )

    // 6. Get bucket usage
    .get(
      '/buckets/:bucketId/usage',
      {
        detail: {
          summary: 'Get bucket storage usage',
          description:
            'Retrieve storage metrics and file counts for a specific bucket over a given time window.',
          tags: ['Storage Buckets'],
        },
        params: t.Object({
          bucketId: t.String({ description: 'Unique bucket identifier' }),
        }),
        query: t.Optional(
          t.Object({
            range: t.Optional(
              t.String({
                description: 'Time window range for usage metrics (e.g. 24h, 7d, 30d, 90d)',
                default: '30d',
              }),
            ),
          }),
        ),
      },
      async ({ db, params: { bucketId }, query }) => {
        const service = new StorageService(db)
        return service.getBucketStorageUsage(bucketId, query?.range)
      },
    )
