import { Elysia, t } from 'elysia'
import { ForbiddenError } from '../../shared/errors'
import type { StorageService } from './service'
import type { StorageCallerAuth } from './types'

export const BucketObjectSchema = t.Object({
  $id: t.String(),
  name: t.String(),
  permissions: t.Array(t.String()),
  fileSecurity: t.Boolean(),
  enabled: t.Boolean(),
  maximumFileSize: t.Number(),
  allowedFileExtensions: t.Array(t.String()),
  compression: t.String(),
  encryption: t.Boolean(),
  antivirus: t.Boolean(),
  $createdAt: t.Optional(t.String()),
  $updatedAt: t.Optional(t.String()),
})

export const FileObjectSchema = t.Object({
  $id: t.String(),
  bucketId: t.String(),
  name: t.String(),
  signature: t.String(),
  mimeType: t.String(),
  sizeOriginal: t.Number(),
  chunksTotal: t.Number(),
  chunksUploaded: t.Number(),
  permissions: t.Array(t.String()),
  $createdAt: t.Optional(t.String()),
  $updatedAt: t.Optional(t.String()),
})

function requireAdminAuth(caller: StorageCallerAuth): void {
  const isAdmin =
    caller.isAdmin ||
    caller.isApiKey ||
    caller.roles?.includes('admin') ||
    caller.roles?.includes('role:admin') ||
    caller.roles?.includes('owner')

  if (!isAdmin) {
    throw new ForbiddenError('Access forbidden', { code: 'general_access_forbidden' })
  }
}

export type StorageServiceResolver =
  | StorageService
  | ((request: Request) => Promise<StorageService> | StorageService)

function getService(
  service: StorageServiceResolver,
  request: Request,
): Promise<StorageService> | StorageService {
  return typeof service === 'function' ? service(request) : service
}

export function storageRoutes(
  service: StorageServiceResolver,
  getCallerAuth: (request: Request) => StorageCallerAuth = () => ({ isAdmin: true }),
) {
  return (
    new Elysia({ name: 'storage-routes' })
      // --- Buckets ---
      .get(
        '/storage/buckets',
        {
          query: t.Object({
            limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
            offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
            search: t.Optional(t.String()),
          }),
          response: t.Object({
            data: t.Array(BucketObjectSchema),
            meta: t.Object({
              total: t.Number(),
              limit: t.Number(),
              offset: t.Number(),
            }),
          }),
          detail: { summary: 'List buckets', tags: ['storage'] },
        },
        async ({ query, request }) => {
          const limit = query.limit ?? 25
          const offset = query.offset ?? 0
          const svc = await getService(service, request)
          const { buckets, total } = await svc.listBuckets({
            limit,
            offset,
            search: query.search,
          })
          return {
            data: buckets,
            meta: { total, limit, offset },
          }
        },
      )
      .post(
        '/storage/buckets',
        {
          body: t.Object({
            bucketId: t.Optional(t.String()),
            name: t.String({ minLength: 1, maxLength: 128 }),
            permissions: t.Optional(t.Array(t.String())),
            fileSecurity: t.Optional(t.Boolean()),
            enabled: t.Optional(t.Boolean()),
            maximumFileSize: t.Optional(t.Integer({ minimum: 1 })),
            allowedFileExtensions: t.Optional(t.Array(t.String())),
            compression: t.Optional(
              t.Union([t.Literal('none'), t.Literal('gzip'), t.Literal('zstd')]),
            ),
            encryption: t.Optional(t.Boolean()),
            antivirus: t.Optional(t.Boolean()),
          }),
          response: BucketObjectSchema,
          detail: { summary: 'Create bucket', tags: ['storage'] },
        },
        async ({ body, request }) => {
          const caller = getCallerAuth(request)
          requireAdminAuth(caller)
          const svc = await getService(service, request)
          return svc.createBucket(body, caller.userId)
        },
      )
      .get(
        '/storage/buckets/:bucketId',
        {
          params: t.Object({ bucketId: t.String() }),
          response: BucketObjectSchema,
          detail: { summary: 'Get bucket', tags: ['storage'] },
        },
        async ({ params: { bucketId }, request }) => {
          const svc = await getService(service, request)
          return svc.getBucket(bucketId)
        },
      )
      .put(
        '/storage/buckets/:bucketId',
        {
          params: t.Object({ bucketId: t.String() }),
          body: t.Object({
            name: t.String({ minLength: 1, maxLength: 128 }),
            permissions: t.Optional(t.Array(t.String())),
            fileSecurity: t.Optional(t.Boolean()),
            enabled: t.Optional(t.Boolean()),
            maximumFileSize: t.Optional(t.Integer({ minimum: 1 })),
            allowedFileExtensions: t.Optional(t.Array(t.String())),
            compression: t.Optional(
              t.Union([t.Literal('none'), t.Literal('gzip'), t.Literal('zstd')]),
            ),
            encryption: t.Optional(t.Boolean()),
            antivirus: t.Optional(t.Boolean()),
          }),
          response: BucketObjectSchema,
          detail: { summary: 'Update bucket', tags: ['storage'] },
        },
        async ({ params: { bucketId }, body, request }) => {
          const caller = getCallerAuth(request)
          requireAdminAuth(caller)
          const svc = await getService(service, request)
          return svc.updateBucket(bucketId, body)
        },
      )
      .delete(
        '/storage/buckets/:bucketId',
        {
          params: t.Object({ bucketId: t.String() }),
          detail: { summary: 'Delete bucket', tags: ['storage'] },
        },
        async ({ params: { bucketId }, request, set }) => {
          const caller = getCallerAuth(request)
          requireAdminAuth(caller)
          const svc = await getService(service, request)
          await svc.deleteBucket(bucketId)
          set.status = 204
        },
      )

      // --- Files ---
      .get(
        '/storage/buckets/:bucketId/files',
        {
          params: t.Object({ bucketId: t.String() }),
          query: t.Object({
            limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
            offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
            search: t.Optional(t.String()),
          }),
          response: t.Object({
            data: t.Array(FileObjectSchema),
            meta: t.Object({
              total: t.Number(),
              limit: t.Number(),
              offset: t.Number(),
            }),
          }),
          detail: { summary: 'List files in bucket', tags: ['storage'] },
        },
        async ({ params: { bucketId }, query, request }) => {
          const limit = query.limit ?? 25
          const offset = query.offset ?? 0
          const svc = await getService(service, request)
          const { files, total } = await svc.listFiles(bucketId, {
            limit,
            offset,
            search: query.search,
          })
          return {
            data: files,
            meta: { total, limit, offset },
          }
        },
      )
      .post(
        '/storage/buckets/:bucketId/files',
        {
          params: t.Object({ bucketId: t.String() }),
          body: t.Object({
            fileId: t.Optional(t.String()),
            file: t.File(),
            permissions: t.Optional(t.Union([t.Array(t.String()), t.String()])),
          }),
          response: FileObjectSchema,
          detail: { summary: 'Upload file to bucket', tags: ['storage'] },
        },
        async ({ params: { bucketId }, body, request }) => {
          const caller = getCallerAuth(request)
          const svc = await getService(service, request)
          const fileObj = body.file
          const arrayBuf = await fileObj.arrayBuffer()
          const buffer = Buffer.from(arrayBuf)

          let permissions: string[] | undefined
          if (Array.isArray(body.permissions)) {
            permissions = body.permissions
          } else if (typeof body.permissions === 'string') {
            try {
              const parsed = JSON.parse(body.permissions)
              if (Array.isArray(parsed)) permissions = parsed
            } catch {
              permissions = [body.permissions]
            }
          }

          return svc.createFile(
            bucketId,
            {
              fileId: body.fileId,
              name: fileObj.name || 'unnamed',
              mimeType: fileObj.type || 'application/octet-stream',
              buffer,
              permissions,
            },
            caller.userId,
          )
        },
      )
      .get(
        '/storage/buckets/:bucketId/files/:fileId',
        {
          params: t.Object({ bucketId: t.String(), fileId: t.String() }),
          response: FileObjectSchema,
          detail: { summary: 'Get file metadata', tags: ['storage'] },
        },
        async ({ params: { bucketId, fileId }, request }) => {
          const svc = await getService(service, request)
          return svc.getFile(bucketId, fileId)
        },
      )
      .get(
        '/storage/buckets/:bucketId/files/:fileId/download',
        {
          params: t.Object({ bucketId: t.String(), fileId: t.String() }),
          detail: { summary: 'Download file', tags: ['storage'] },
        },
        async ({ params: { bucketId, fileId }, request, set }) => {
          const svc = await getService(service, request)
          const { file, buffer } = await svc.readFile(bucketId, fileId)
          set.headers['content-disposition'] =
            `attachment; filename="${encodeURIComponent(file.name)}"`
          set.headers['content-type'] = file.mimeType
          return buffer
        },
      )
      .get(
        '/storage/buckets/:bucketId/files/:fileId/view',
        {
          params: t.Object({ bucketId: t.String(), fileId: t.String() }),
          detail: { summary: 'View file inline', tags: ['storage'] },
        },
        async ({ params: { bucketId, fileId }, request, set }) => {
          const svc = await getService(service, request)
          const { file, buffer } = await svc.readFile(bucketId, fileId)
          set.headers['content-disposition'] = 'inline'
          set.headers['content-type'] = file.mimeType
          return buffer
        },
      )
      .get(
        '/storage/buckets/:bucketId/files/:fileId/preview',
        {
          params: t.Object({ bucketId: t.String(), fileId: t.String() }),
          query: t.Object({
            width: t.Optional(t.Integer({ minimum: 1, maximum: 4000 })),
            height: t.Optional(t.Integer({ minimum: 1, maximum: 4000 })),
            rotation: t.Optional(t.Integer({ minimum: -360, maximum: 360 })),
            output: t.Optional(
              t.Union([t.Literal('jpeg'), t.Literal('png'), t.Literal('webp'), t.Literal('avif')]),
            ),
          }),
          detail: { summary: 'Preview file', tags: ['storage'] },
        },
        async ({ params: { bucketId, fileId }, query, request, set }) => {
          const svc = await getService(service, request)
          const { buffer, mimeType } = await svc.previewFile(bucketId, fileId, query)
          set.headers['content-type'] = mimeType
          return buffer
        },
      )
      .put(
        '/storage/buckets/:bucketId/files/:fileId',
        {
          params: t.Object({ bucketId: t.String(), fileId: t.String() }),
          body: t.Object({
            name: t.Optional(t.String({ minLength: 1, maxLength: 256 })),
            permissions: t.Optional(t.Array(t.String())),
          }),
          response: FileObjectSchema,
          detail: { summary: 'Update file metadata', tags: ['storage'] },
        },
        async ({ params: { bucketId, fileId }, body, request }) => {
          const svc = await getService(service, request)
          return svc.updateFile(bucketId, fileId, body)
        },
      )
      .delete(
        '/storage/buckets/:bucketId/files/:fileId',
        {
          params: t.Object({ bucketId: t.String(), fileId: t.String() }),
          detail: { summary: 'Delete file', tags: ['storage'] },
        },
        async ({ params: { bucketId, fileId }, request, set }) => {
          const svc = await getService(service, request)
          await svc.deleteFile(bucketId, fileId)
          set.status = 204
        },
      )
  )
}
