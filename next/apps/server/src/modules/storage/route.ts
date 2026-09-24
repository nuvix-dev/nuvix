import type { TenantResource } from '@nuvix/core/tenants'
import { type Doc, Query, type Session } from '@nuvix/db'
import { Local } from '@nuvix/storage'
import { config } from '@nuvix/utils'
import { Elysia, t } from 'elysia'
import type { Users } from '../../types/generated'
import { FilesService } from './files.service'
import { StorageService } from './service'

export const storageRoutes = () =>
  new Elysia({ prefix: '/storage' })
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
      tenantResource: ('tenantResource' in ctx
        ? ctx.tenantResource
        : undefined) as unknown as TenantResource,
      isAPIUser: ('isAPIUser' in ctx ? ctx.isAPIUser : false) as boolean,
      isAdmin: ('isAdmin' in ctx ? ctx.isAdmin : false) as boolean,
    }))

    // =========================================================================
    // Bucket routes — GET/POST/PUT/DELETE /storage/buckets
    // =========================================================================

    // 1. List buckets
    .get(
      '/buckets',
      {
        query: t.Optional(
          t.Object({
            search: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
            cursor: t.Optional(t.String()),
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
        body: t.Object({
          bucketId: t.Optional(t.String()),
          name: t.String(),
          permissions: t.Optional(t.Array(t.String())),
          fileSecurity: t.Optional(t.Boolean()),
          enabled: t.Optional(t.Boolean()),
          maximumFileSize: t.Optional(t.Number()),
          allowedFileExtensions: t.Optional(t.Array(t.String())),
          compression: t.Optional(t.String()),
          encryption: t.Optional(t.Boolean()),
          antivirus: t.Optional(t.Boolean()),
        }),
      },
      async ({ db, body }) => {
        const service = new StorageService(db, new Local(config.storage.uploadsDir))
        return service.createBucket(body)
      },
    )

    // 3. Get bucket
    .get(
      '/buckets/:bucketId',
      {
        params: t.Object({ bucketId: t.String() }),
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
        params: t.Object({ bucketId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          permissions: t.Optional(t.Array(t.String())),
          fileSecurity: t.Optional(t.Boolean()),
          enabled: t.Optional(t.Boolean()),
          maximumFileSize: t.Optional(t.Number()),
          allowedFileExtensions: t.Optional(t.Array(t.String())),
          compression: t.Optional(t.String()),
          encryption: t.Optional(t.Boolean()),
          antivirus: t.Optional(t.Boolean()),
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
        params: t.Object({ bucketId: t.String() }),
      },
      async ({ db, params: { bucketId } }) => {
        const service = new StorageService(db, new Local(config.storage.uploadsDir))
        await service.deleteBucket(bucketId)
        return { status: 'ok' }
      },
    )

    // 6. Get storage usage
    .get(
      '/usage',
      {
        query: t.Optional(
          t.Object({
            range: t.Optional(t.String()),
          }),
        ),
      },
      async ({ db, query }) => {
        const service = new StorageService(db)
        return service.getStorageUsage(query?.range)
      },
    )

    // 7. Get bucket usage
    .get(
      '/buckets/:bucketId/usage',
      {
        params: t.Object({ bucketId: t.String() }),
        query: t.Optional(
          t.Object({
            range: t.Optional(t.String()),
          }),
        ),
      },
      async ({ db, params: { bucketId }, query }) => {
        const service = new StorageService(db)
        return service.getBucketStorageUsage(bucketId, query?.range)
      },
    )

    // =========================================================================
    // File routes — /storage/buckets/:bucketId/files
    // =========================================================================

    // 8. List files
    .get(
      '/buckets/:bucketId/files',
      {
        params: t.Object({ bucketId: t.String() }),
        query: t.Optional(
          t.Object({
            search: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
            cursor: t.Optional(t.String()),
          }),
        ),
      },
      async ({ db, tenantResource, isAPIUser, isAdmin, params: { bucketId }, query }) => {
        const systemSession = tenantResource.authSystemSession()
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        if (query?.cursor) queries.push(Query.cursorAfter(query.cursor))
        return service.getFiles(bucketId, { isAPIUser, isAdmin }, queries, query?.search)
      },
    )

    // 9. Create / upload file (multipart)
    .post(
      '/buckets/:bucketId/files',
      {
        params: t.Object({ bucketId: t.String() }),
        body: t.Object({
          fileId: t.Optional(t.String()),
          permissions: t.Optional(t.Array(t.String())),
          file: t.File(),
        }),
        headers: t.Optional(
          t.Object({
            'content-range': t.Optional(t.String()),
            'x-nuvix-id': t.Optional(t.String()),
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
        const systemSession = tenantResource.authSystemSession()
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)

        const uploadedFile = body.file as File
        // Save to temp path for device upload
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

    // 10. Get file metadata
    .get(
      '/buckets/:bucketId/files/:fileId',
      {
        params: t.Object({ bucketId: t.String(), fileId: t.String() }),
      },
      async ({ db, tenantResource, isAPIUser, isAdmin, params: { bucketId, fileId } }) => {
        const systemSession = tenantResource.authSystemSession()
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)
        return service.getFile(bucketId, fileId, { isAPIUser, isAdmin })
      },
    )

    // 11. Preview file (image processing)
    .get(
      '/buckets/:bucketId/files/:fileId/preview',
      {
        params: t.Object({ bucketId: t.String(), fileId: t.String() }),
        query: t.Optional(
          t.Object({
            width: t.Optional(t.String()),
            height: t.Optional(t.String()),
            gravity: t.Optional(t.String()),
            quality: t.Optional(t.String()),
            borderWidth: t.Optional(t.String()),
            borderColor: t.Optional(t.String()),
            borderRadius: t.Optional(t.String()),
            opacity: t.Optional(t.String()),
            rotation: t.Optional(t.String()),
            background: t.Optional(t.String()),
            output: t.Optional(t.String()),
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
        const systemSession = tenantResource.authSystemSession()
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

    // 12. Download file (attachment)
    .get(
      '/buckets/:bucketId/files/:fileId/download',
      {
        params: t.Object({ bucketId: t.String(), fileId: t.String() }),
        headers: t.Optional(t.Object({ range: t.Optional(t.String()) })),
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
        const systemSession = tenantResource.authSystemSession()
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

    // 13. View file (inline)
    .get(
      '/buckets/:bucketId/files/:fileId/view',
      {
        params: t.Object({ bucketId: t.String(), fileId: t.String() }),
        headers: t.Optional(t.Object({ range: t.Optional(t.String()) })),
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
        const systemSession = tenantResource.authSystemSession()
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

    // 14. Update file (name, permissions)
    .put(
      '/buckets/:bucketId/files/:fileId',
      {
        params: t.Object({ bucketId: t.String(), fileId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          permissions: t.Optional(t.Array(t.String())),
        }),
      },
      async ({ db, tenantResource, isAPIUser, isAdmin, params: { bucketId, fileId }, body }) => {
        const systemSession = tenantResource.authSystemSession()
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)
        return service.updateFile(bucketId, fileId, body, { isAPIUser, isAdmin })
      },
    )

    // 15. Delete file
    .delete(
      '/buckets/:bucketId/files/:fileId',
      {
        params: t.Object({ bucketId: t.String(), fileId: t.String() }),
      },
      async ({ db, tenantResource, isAPIUser, isAdmin, params: { bucketId, fileId } }) => {
        const systemSession = tenantResource.authSystemSession()
        const device = new Local(config.storage.uploadsDir)
        const service = new FilesService(db, systemSession, device)
        await service.deleteFile(bucketId, fileId, { isAPIUser, isAdmin })
        return { status: 'ok' }
      },
    )
