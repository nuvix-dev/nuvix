import type { TenantResource } from '@nuvix/core/tenants'
import { type Doc, Query, type Session } from '@nuvix/db'
import { Local } from '@nuvix/storage'
import { config } from '@nuvix/utils'
import { Elysia, t } from 'elysia'
import type { Users } from '../../types/generated'
import { FilesService } from './service'

export const storageFilesRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
      tenantResource: ('tenantResource' in ctx
        ? ctx.tenantResource
        : undefined) as unknown as TenantResource,
      isAPIUser: ('isAPIUser' in ctx ? ctx.isAPIUser : false) as boolean,
      isAdmin: ('isAdmin' in ctx ? ctx.isAdmin : false) as boolean,
    }))

    // 1. List files in bucket
    .get(
      '/buckets/:bucketId/files',
      {
        detail: {
          summary: 'List files',
          description:
            'Retrieve a paginated list of files stored inside a bucket with optional search and cursor pagination.',
          tags: ['Storage Files'],
        },
        params: t.Object({
          bucketId: t.String({ description: 'Unique bucket identifier' }),
        }),
        query: t.Optional(
          t.Object({
            search: t.Optional(
              t.String({
                description: 'Search string to filter files by name or signature',
              }),
            ),
            limit: t.Optional(
              t.String({
                description: 'Maximum number of files to return',
                pattern: '^[0-9]+$',
              }),
            ),
            offset: t.Optional(
              t.String({
                description: 'Number of files to skip before returning results',
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
      async ({ db, tenantResource, isAPIUser, isAdmin, params: { bucketId }, query }) => {
        const systemSession = tenantResource?.authSystemSession() ?? db
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        if (query?.cursor) queries.push(Query.cursorAfter(query.cursor))
        return service.getFiles(bucketId, { isAPIUser, isAdmin }, queries, query?.search)
      },
    )

    // 2. Create / upload file (multipart)
    .post(
      '/buckets/:bucketId/files',
      {
        detail: {
          summary: 'Upload file',
          description:
            'Upload a new binary or multipart file to a specific storage bucket with optional chunk support.',
          tags: ['Storage Files'],
        },
        params: t.Object({
          bucketId: t.String({ description: 'Unique bucket identifier' }),
        }),
        body: t.Object({
          fileId: t.Optional(
            t.String({
              description: 'Custom unique file identifier. If omitted, a unique ID is generated.',
            }),
          ),
          permissions: t.Optional(
            t.Array(
              t.String({
                description: 'Permission string specifying read/write access',
              }),
              {
                description: 'File-level access permissions list',
              },
            ),
          ),
          file: t.File({
            description: 'Binary file payload to upload',
          }),
        }),
        headers: t.Optional(
          t.Object({
            'content-range': t.Optional(
              t.String({
                description: 'Content-Range header for chunked uploads (e.g. bytes 0-1023/2048)',
              }),
            ),
            'x-nuvix-id': t.Optional(
              t.String({
                description: 'Unique file ID header for tracking multipart chunk uploads',
              }),
            ),
          }),
        ),
      },
      async ({
        db,
        tenantResource,
        user,
        isAPIUser,
        isAdmin,
        params: { bucketId },
        body,
        headers,
      }) => {
        const systemSession = tenantResource?.authSystemSession() ?? db
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)

        const uploadedFile = body.file as File
        const tmpPath = `${config.storage.uploadsDir}/.tmp/${Date.now()}-${uploadedFile.name}`
        const arrayBuffer = await uploadedFile.arrayBuffer()
        await Bun.write(tmpPath, arrayBuffer)

        const upload = {
          filepath: tmpPath,
          filename: uploadedFile.name,
          mimetype: uploadedFile.type || 'application/octet-stream',
        }

        const userId = user && !user.empty() ? user.getId() : undefined

        return service.createFile(
          bucketId,
          { fileId: body.fileId, permissions: body.permissions },
          upload,
          { isAPIUser, isAdmin },
          headers?.['content-range'],
          headers?.['x-nuvix-id'],
          userId,
        )
      },
    )

    // 3. Get file metadata
    .get(
      '/buckets/:bucketId/files/:fileId',
      {
        detail: {
          summary: 'Get file metadata',
          description:
            'Retrieve metadata details of a specific file without downloading its content.',
          tags: ['Storage Files'],
        },
        params: t.Object({
          bucketId: t.String({ description: 'Unique bucket identifier' }),
          fileId: t.String({ description: 'Unique file identifier' }),
        }),
      },
      async ({ db, tenantResource, isAPIUser, isAdmin, params: { bucketId, fileId } }) => {
        const systemSession = tenantResource?.authSystemSession() ?? db
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)
        return service.getFile(bucketId, fileId, { isAPIUser, isAdmin })
      },
    )

    // 4. Preview file (image transformation)
    .get(
      '/buckets/:bucketId/files/:fileId/preview',
      {
        detail: {
          summary: 'Preview file',
          description:
            'Generate and stream an image preview with optional dynamic resizing, cropping, rotation, and formatting.',
          tags: ['Storage Files'],
        },
        params: t.Object({
          bucketId: t.String({ description: 'Unique bucket identifier' }),
          fileId: t.String({ description: 'Unique file identifier' }),
        }),
        query: t.Optional(
          t.Object({
            width: t.Optional(t.String({ description: 'Target image width in pixels' })),
            height: t.Optional(t.String({ description: 'Target image height in pixels' })),
            gravity: t.Optional(
              t.String({
                description: 'Crop gravity alignment: center, top-left, top, top-right, etc.',
              }),
            ),
            quality: t.Optional(t.String({ description: 'Image compression quality (1-100)' })),
            borderWidth: t.Optional(t.String({ description: 'Border width in pixels' })),
            borderColor: t.Optional(t.String({ description: 'Border hex color code' })),
            borderRadius: t.Optional(t.String({ description: 'Border corner radius in pixels' })),
            opacity: t.Optional(t.String({ description: 'Image opacity (0.0 - 1.0)' })),
            rotation: t.Optional(t.String({ description: 'Clockwise rotation in degrees' })),
            background: t.Optional(t.String({ description: 'Background hex color' })),
            output: t.Optional(
              t.String({ description: 'Output format conversion (jpg, png, webp)' }),
            ),
          }),
        ),
      },
      async ({
        db,
        tenantResource,
        isAPIUser,
        isAdmin,
        params: { bucketId, fileId },
        query,
        set,
      }) => {
        const systemSession = tenantResource?.authSystemSession() ?? db
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)
        const result = await service.previewFile(
          bucketId,
          fileId,
          { isAPIUser, isAdmin },
          {
            width: query?.width ? Number(query.width) : undefined,
            height: query?.height ? Number(query.height) : undefined,
            gravity: query?.gravity,
            quality: query?.quality ? Number(query.quality) : undefined,
            borderWidth: query?.borderWidth ? Number(query.borderWidth) : undefined,
            borderColor: query?.borderColor,
            borderRadius: query?.borderRadius ? Number(query.borderRadius) : undefined,
            opacity: query?.opacity ? Number(query.opacity) : undefined,
            rotation: query?.rotation ? Number(query.rotation) : undefined,
            background: query?.background,
            output: query?.output,
          },
        )
        set.headers['Content-Type'] = result.mimeType
        set.headers['Content-Disposition'] = `inline; filename="${result.fileName}"`
        set.headers['Cache-Control'] = 'public, max-age=86400'
        return result.buffer
      },
    )

    // 5. Download file
    .get(
      '/buckets/:bucketId/files/:fileId/download',
      {
        detail: {
          summary: 'Download file',
          description: 'Download file content as an attachment with byte-range streaming support.',
          tags: ['Storage Files'],
        },
        params: t.Object({
          bucketId: t.String({ description: 'Unique bucket identifier' }),
          fileId: t.String({ description: 'Unique file identifier' }),
        }),
        headers: t.Optional(
          t.Object({
            range: t.Optional(
              t.String({ description: 'HTTP range request header (e.g. bytes=0-1023)' }),
            ),
          }),
        ),
      },
      async ({
        db,
        tenantResource,
        isAPIUser,
        isAdmin,
        params: { bucketId, fileId },
        headers,
        set,
      }) => {
        const systemSession = tenantResource?.authSystemSession() ?? db
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)
        const result = await service.serveFile(
          bucketId,
          fileId,
          { isAPIUser, isAdmin },
          'attachment',
          headers?.range,
        )
        set.headers['Content-Type'] = result.mimeType
        set.headers['Content-Disposition'] = `attachment; filename="${result.fileName}"`
        set.headers.Expires = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toUTCString()
        if (result.partial) {
          set.headers['Content-Range'] = `bytes ${result.start}-${result.end}/${result.size}`
          set.headers['Accept-Ranges'] = 'bytes'
          set.headers['Content-Length'] = String(result.end - result.start + 1)
          set.status = 206
        } else {
          set.headers['Content-Length'] = String(result.size)
        }
        return result.buffer
      },
    )

    // 6. View file (inline)
    .get(
      '/buckets/:bucketId/files/:fileId/view',
      {
        detail: {
          summary: 'View file inline',
          description:
            'Stream file content directly for inline viewing in browser (e.g. PDF, images, video) with range requests.',
          tags: ['Storage Files'],
        },
        params: t.Object({
          bucketId: t.String({ description: 'Unique bucket identifier' }),
          fileId: t.String({ description: 'Unique file identifier' }),
        }),
        headers: t.Optional(
          t.Object({
            range: t.Optional(t.String({ description: 'HTTP range request header' })),
          }),
        ),
      },
      async ({
        db,
        tenantResource,
        isAPIUser,
        isAdmin,
        params: { bucketId, fileId },
        headers,
        set,
      }) => {
        const systemSession = tenantResource?.authSystemSession() ?? db
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)
        const result = await service.serveFile(
          bucketId,
          fileId,
          { isAPIUser, isAdmin },
          'inline',
          headers?.range,
        )
        set.headers['Content-Type'] = result.mimeType
        set.headers['Content-Disposition'] = `inline; filename="${result.fileName}"`
        set.headers.Expires = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toUTCString()
        if (result.partial) {
          set.headers['Content-Range'] = `bytes ${result.start}-${result.end}/${result.size}`
          set.headers['Accept-Ranges'] = 'bytes'
          set.headers['Content-Length'] = String(result.end - result.start + 1)
          set.status = 206
        } else {
          set.headers['Content-Length'] = String(result.size)
        }
        return result.buffer
      },
    )

    // 7. Update file metadata
    .put(
      '/buckets/:bucketId/files/:fileId',
      {
        detail: {
          summary: 'Update file metadata',
          description: 'Update the name or permissions of an existing file in a bucket.',
          tags: ['Storage Files'],
        },
        params: t.Object({
          bucketId: t.String({ description: 'Unique bucket identifier' }),
          fileId: t.String({ description: 'Unique file identifier' }),
        }),
        body: t.Object({
          name: t.Optional(
            t.String({
              description: 'Updated file name',
            }),
          ),
          permissions: t.Optional(
            t.Array(
              t.String({
                description: 'Permission string',
              }),
              {
                description: 'Updated file access permissions list',
              },
            ),
          ),
        }),
      },
      async ({ db, tenantResource, isAPIUser, isAdmin, params: { bucketId, fileId }, body }) => {
        const systemSession = tenantResource?.authSystemSession() ?? db
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)
        return service.updateFile(bucketId, fileId, body, { isAPIUser, isAdmin })
      },
    )

    // 8. Delete file
    .delete(
      '/buckets/:bucketId/files/:fileId',
      {
        detail: {
          summary: 'Delete file',
          description: 'Permanently delete a file from the bucket and remove stored disk data.',
          tags: ['Storage Files'],
        },
        params: t.Object({
          bucketId: t.String({ description: 'Unique bucket identifier' }),
          fileId: t.String({ description: 'Unique file identifier' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Status confirmation string' }),
          }),
        },
      },
      async ({ db, tenantResource, isAPIUser, isAdmin, params: { bucketId, fileId } }) => {
        const systemSession = tenantResource?.authSystemSession() ?? db
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)
        await service.deleteFile(bucketId, fileId, { isAPIUser, isAdmin })
        return { status: 'ok' as const }
      },
    )
