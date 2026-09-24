import * as fs from 'node:fs/promises'
import nodePath from 'node:path'
import {
  Doc,
  ID,
  KeyValidator,
  Permission,
  PermissionType,
  Query,
  Role,
  type Session,
} from '@nuvix/db'
import { type Device, FileExt, FileSize } from '@nuvix/storage'
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../shared/errors'
import type { Files } from '../../types/generated'
import { type FileView, formatFile } from './formatter'

export interface CreateFileInput {
  fileId?: string
  permissions?: string[]
}

export interface UpdateFileInput {
  name?: string
  permissions?: string[]
}

export interface FileUploadData {
  filepath: string
  filename: string
  mimetype: string
}

export interface FileContext {
  isAPIUser: boolean
  isAdmin: boolean
}

export class FilesService {
  constructor(
    private readonly session: Session,
    private readonly systemSession: Session,
    private readonly device: Device,
  ) {}

  /**
   * List files in a bucket.
   */
  async getFiles(
    bucketId: string,
    ctx: FileContext,
    queries: Query[] = [],
    search?: string,
  ): Promise<{ total: number; files: FileView[] }> {
    const bucket = await this.systemSession.getDocument('buckets', bucketId)

    if (bucket.empty() || (!bucket.get('enabled') && !ctx.isAPIUser && !ctx.isAdmin)) {
      throw new NotFoundError('Storage bucket not found', {
        code: 'storage_bucket_not_found',
      })
    }

    const fileSecurity = bucket.get('fileSecurity') ?? false
    const bucketRead = bucket.getRead()
    const canRead =
      bucketRead.length > 0 && this.session.ctx.roles.some((role) => bucketRead.includes(role))

    if (!fileSecurity && !canRead) {
      throw new UnauthorizedError('Unauthorized', { code: 'user_unauthorized' })
    }

    const q = [...queries, Query.equal('bucketId', [bucketId])]
    if (search) {
      q.push(Query.search('search', search))
    }
    const filterQueries = Query.groupByType(q).filters

    const session = fileSecurity && !canRead ? this.session : this.systemSession
    const docs = await session.find('files', q)
    const total = await session.count('files', filterQueries)

    return {
      total,
      files: docs.map(formatFile),
    }
  }

  /**
   * Create (upload) a file — supports single-request and resumable chunked uploads.
   *
   * Chunked upload flow via Content-Range header:
   * - First chunk creates the file document with chunked=true metadata.
   * - Subsequent chunks validate against the existing document.
   * - Final chunk triggers assembly, hash, and document finalization.
   *
   * Headers:
   *   Content-Range: bytes <start>-<end>/<total>
   *   x-nuvix-id: <fileId>  (required for chunks after the first)
   */
  async createFile(
    bucketId: string,
    input: CreateFileInput,
    upload: FileUploadData,
    ctx: FileContext,
    contentRange?: string,
    headerFileId?: string,
    userId?: string,
  ): Promise<FileView> {
    const bucket = await this.systemSession.getDocument('buckets', bucketId)

    if (bucket.empty() || (!bucket.get('enabled') && !ctx.isAPIUser && !ctx.isAdmin)) {
      throw new NotFoundError('Storage bucket not found', {
        code: 'storage_bucket_not_found',
      })
    }

    const bucketCreate = bucket.getCreate()
    const canCreate =
      bucketCreate.length > 0 && this.session.ctx.roles.some((role) => bucketCreate.includes(role))

    if (!canCreate) {
      throw new UnauthorizedError('Unauthorized', { code: 'user_unauthorized' })
    }

    const allowedPermissions = [PermissionType.Read, PermissionType.Update, PermissionType.Delete]

    let permissions: (string | Permission)[] =
      Permission.aggregate(input.permissions ?? [], allowedPermissions) ?? []
    if (permissions.length === 0) {
      permissions = userId
        ? [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
          ]
        : []
    }

    const maximumFileSize = bucket.get('maximumFileSize') ?? 30_000_000

    const { filepath, filename, mimetype } = upload
    const stats = await fs.stat(filepath)
    const fileSize = stats.size
    const fileExt = filename.split('.').pop()?.toLowerCase() ?? ''

    if (!fileSize || fileSize <= 0) {
      throw new BadRequestError('File size is zero', { code: 'storage_file_empty' })
    }

    let fileId =
      !input.fileId || input.fileId === 'unique()' ? ID.unique() : (input.fileId as string)
    let chunk = 1
    let chunks = 1
    let chunkSize = 0
    let rangeStart = 0
    let rangeEnd = 0
    let finalFileSize = fileSize
    let isChunkedUpload = false

    if (contentRange) {
      isChunkedUpload = true
      const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange.trim())
      if (!match) {
        throw new BadRequestError('Invalid Content-Range header format', {
          code: 'storage_invalid_content_range',
        })
      }

      const [, startStr, endStr, sizeStr] = match
      rangeStart = Number(startStr)
      rangeEnd = Number(endStr)
      const totalSize = Number(sizeStr)

      if (
        !Number.isFinite(rangeStart) ||
        !Number.isFinite(rangeEnd) ||
        !Number.isFinite(totalSize) ||
        !Number.isInteger(rangeStart) ||
        !Number.isInteger(rangeEnd) ||
        !Number.isInteger(totalSize)
      ) {
        throw new BadRequestError('Content-Range values must be valid integers', {
          code: 'storage_invalid_content_range',
        })
      }

      if (rangeStart < 0) {
        throw new BadRequestError('Range start must be non-negative', {
          code: 'storage_invalid_content_range',
        })
      }
      if (rangeEnd < rangeStart) {
        throw new BadRequestError('Range end must be >= range start', {
          code: 'storage_invalid_content_range',
        })
      }
      if (rangeEnd >= totalSize) {
        throw new BadRequestError('Range end must be less than total size', {
          code: 'storage_invalid_content_range',
        })
      }
      if (totalSize <= 0) {
        throw new BadRequestError('Total size must be positive', {
          code: 'storage_invalid_content_range',
        })
      }

      // Override fileId from x-nuvix-id header for subsequent chunks
      if (headerFileId) {
        if (!new KeyValidator().$valid(headerFileId)) {
          throw new BadRequestError('Invalid file ID in x-nuvix-id header', {
            code: 'invalid_params',
          })
        }
        fileId = headerFileId
      }

      chunkSize = rangeEnd - rangeStart + 1

      if (fileSize !== chunkSize) {
        throw new BadRequestError(
          `Chunk size mismatch: uploaded ${fileSize}, declared ${chunkSize}`,
          { code: 'storage_invalid_content_range' },
        )
      }

      const isLastChunk = rangeEnd + 1 === totalSize
      if (isLastChunk && rangeStart > 0 && totalSize % chunkSize !== 0) {
        chunk = -1
        chunks = -1
      } else {
        chunks = Math.ceil(totalSize / chunkSize)
        chunk = Math.floor(rangeStart / chunkSize) + 1

        const expectedStart = (chunk - 1) * chunkSize
        if (rangeStart !== expectedStart) {
          throw new BadRequestError(
            `Chunk not aligned. Expected ${expectedStart} but got ${rangeStart}`,
            { code: 'storage_invalid_content_range' },
          )
        }

        if (chunk === chunks) {
          const expectedLastChunkSize = totalSize - expectedStart
          if (chunkSize !== expectedLastChunkSize) {
            throw new BadRequestError(
              `Last chunk size mismatch. Expected ${expectedLastChunkSize} but got ${chunkSize}`,
              { code: 'storage_invalid_content_range' },
            )
          }
        }
      }

      finalFileSize = totalSize
    }

    // Validate extension against bucket allow-list
    const allowedFileExtensions = (bucket.get('allowedFileExtensions') as string[]) ?? []
    const fileExtValidator = new FileExt(allowedFileExtensions)
    if (allowedFileExtensions.length && !fileExtValidator.isValid(filename)) {
      throw new BadRequestError('File extension not allowed', {
        code: 'storage_file_type_unsupported',
      })
    }

    // Validate total size against bucket limit
    const fileSizeValidator = new FileSize(maximumFileSize)
    if (!fileSizeValidator.isValid(finalFileSize)) {
      throw new BadRequestError(
        `File size (${finalFileSize} bytes) exceeds the bucket limit (${maximumFileSize} bytes)`,
        { code: 'storage_invalid_file_size' },
      )
    }

    const _path = this.device.getPath(nodePath.join(bucketId, `${fileId}.${fileExt}`))

    const fileDocument = await this.systemSession.getDocument('files', fileId)
    let metadata: Record<string, unknown> = {
      content_type: mimetype,
      ...(isChunkedUpload && {
        chunked: true,
        chunkSize,
        uploadStartedAt: Date.now(),
      }),
    }
    let chunksUploaded = 0

    if (!fileDocument.empty()) {
      const existingChunksTotal = fileDocument.get('chunksTotal') ?? 1
      chunksUploaded = fileDocument.get('chunksUploaded') ?? 0
      metadata = (fileDocument.get('metadata') as Record<string, unknown>) ?? {}
      const existingSizeOriginal = fileDocument.get('sizeOriginal') ?? 0

      if (isChunkedUpload) {
        if (existingSizeOriginal !== finalFileSize) {
          throw new BadRequestError(
            `File size mismatch: existing ${existingSizeOriginal}, declared ${finalFileSize}`,
            { code: 'storage_invalid_content_range' },
          )
        }
        if (chunks !== -1 && existingChunksTotal !== chunks) {
          throw new BadRequestError(
            `Chunk count mismatch: existing ${existingChunksTotal}, calculated ${chunks}`,
            { code: 'storage_invalid_content_range' },
          )
        }
        const existingChunkSize = (metadata.chunkSize as number) | 0
        if (existingChunkSize && chunk !== chunks && chunkSize !== existingChunkSize) {
          throw new BadRequestError(
            `Chunk size mismatch: expected ${existingChunkSize} but got ${chunkSize}`,
            { code: 'storage_invalid_content_range' },
          )
        }
      }

      chunks = existingChunksTotal
      if (chunk === -1) {
        chunk = existingChunksTotal
      }

      if (isChunkedUpload) {
        const uploadedChunks = (metadata.uploadedChunks as number[]) ?? []
        if (uploadedChunks.includes(chunk)) {
          throw new BadRequestError(`Chunk ${chunk} already uploaded`, {
            code: 'storage_file_already_exists',
          })
        }
      }

      if (chunksUploaded === existingChunksTotal) {
        throw new BadRequestError('File already exists', {
          code: 'storage_file_already_exists',
        })
      }
    } else if (isChunkedUpload && chunk !== 1) {
      throw new NotFoundError('Upload session not found. First chunk must be uploaded first.', {
        code: 'storage_file_not_found',
      })
    }

    // Perform the device upload
    try {
      chunksUploaded = await this.device.upload(filepath, _path, chunk, chunks, metadata)
    } catch (error) {
      await fs.unlink(filepath).catch(() => {})
      throw new BadRequestError(
        `Failed uploading chunk ${chunk}/${chunks}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { code: 'general_server_error' },
      )
    }

    if (!chunksUploaded) {
      throw new BadRequestError('Device returned zero chunks uploaded', {
        code: 'general_server_error',
      })
    }

    if (isChunkedUpload) {
      const uploadedChunks = (metadata.uploadedChunks as number[]) ?? []
      if (!uploadedChunks.includes(chunk)) {
        uploadedChunks.push(chunk)
        uploadedChunks.sort((a, b) => a - b)
      }
      metadata.uploadedChunks = uploadedChunks
      metadata.lastChunkUploadedAt = Date.now()
    }

    if (chunksUploaded === chunks) {
      // === All chunks uploaded — finalize ===
      const fileHash = await this.device.getFileHash(_path)

      const data = await this.device.read(_path)
      if (data) {
        if (!(await this.device.write(_path, data, mimetype))) {
          throw new BadRequestError('Failed to save file', { code: 'general_server_error' })
        }
      }

      let sizeActual: number
      try {
        const finalStats = await fs.stat(
          this.device.getPath(nodePath.join(bucketId, `${fileId}.${fileExt}`)),
        )
        sizeActual = finalStats.size
      } catch {
        sizeActual = fileSize
      }

      const finalMetadata: Record<string, unknown> = {
        content_type: mimetype,
        completedAt: Date.now(),
        ...(isChunkedUpload && {
          chunked: true,
          chunkSize: metadata.chunkSize,
          uploadStartedAt: metadata.uploadStartedAt,
        }),
      }

      if (fileDocument.empty()) {
        const created = await this.systemSession.createDocument(
          'files',
          new Doc<Files>({
            $id: fileId,
            $permissions: permissions,
            bucketId: bucket.getId(),
            bucketInternalId: bucket.getSequence(),
            name: filename,
            path: _path,
            signature: fileHash,
            mimeType: mimetype,
            sizeOriginal: finalFileSize,
            sizeActual,
            chunksTotal: chunks,
            chunksUploaded,
            search: [fileId, filename].join(' '),
            metadata: finalMetadata,
          }),
        )
        return formatFile(created)
      }

      fileDocument.set('$permissions', permissions)
      fileDocument.set('signature', fileHash)
      fileDocument.set('mimeType', mimetype)
      fileDocument.set('sizeActual', sizeActual)
      fileDocument.set('metadata', finalMetadata)
      fileDocument.set('chunksUploaded', chunksUploaded)

      const updated = await this.systemSession.updateDocument('files', fileId, fileDocument)
      return formatFile(updated)
    }

    if (fileDocument.empty()) {
      // === First chunk of a new chunked upload ===
      const created = await this.systemSession.createDocument(
        'files',
        new Doc<Files>({
          $id: fileId,
          $permissions: permissions,
          bucketId: bucket.getId(),
          bucketInternalId: bucket.getSequence(),
          name: filename,
          path: _path,
          signature: '',
          mimeType: '',
          sizeOriginal: finalFileSize,
          sizeActual: 0,
          chunksTotal: chunks,
          chunksUploaded,
          search: [fileId, filename].join(' '),
          metadata,
        }),
      )
      return formatFile(created)
    }

    // === Intermediate chunk of an existing chunked upload ===
    fileDocument.set('chunksUploaded', chunksUploaded)
    fileDocument.set('metadata', metadata)
    const updated = await this.systemSession.updateDocument('files', fileId, fileDocument)
    return formatFile(updated)
  }

  /**
   * Get file metadata.
   */
  async getFile(bucketId: string, fileId: string, ctx: FileContext): Promise<FileView> {
    const bucket = await this.systemSession.getDocument('buckets', bucketId)

    if (bucket.empty() || (!bucket.get('enabled') && !ctx.isAPIUser && !ctx.isAdmin)) {
      throw new NotFoundError('Storage bucket not found', {
        code: 'storage_bucket_not_found',
      })
    }

    const fileSecurity = bucket.get('fileSecurity') ?? false
    const bucketRead = bucket.getRead()
    const canRead =
      bucketRead.length > 0 && this.session.ctx.roles.some((role) => bucketRead.includes(role))

    if (!fileSecurity && !canRead) {
      throw new UnauthorizedError('Unauthorized', { code: 'user_unauthorized' })
    }

    const session = fileSecurity && !canRead ? this.session : this.systemSession
    const file = await session.getDocument('files', fileId)
    if (file.empty()) {
      throw new NotFoundError('File not found', { code: 'storage_file_not_found' })
    }

    return formatFile(file)
  }

  /**
   * Preview a file image (supports width/height/quality/rotation/etc).
   */
  async previewFile(
    bucketId: string,
    fileId: string,
    ctx: FileContext,
    params: {
      width?: number
      height?: number
      gravity?: string
      quality?: number
      borderWidth?: number
      borderColor?: string
      borderRadius?: number
      opacity?: number
      rotation?: number
      background?: string
      output?: string
    },
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const bucket = await this.systemSession.getDocument('buckets', bucketId)

    if (bucket.empty() || (!bucket.get('enabled') && !ctx.isAPIUser && !ctx.isAdmin)) {
      throw new NotFoundError('Storage bucket not found', {
        code: 'storage_bucket_not_found',
      })
    }

    const fileSecurity = bucket.get('fileSecurity') ?? false
    const bucketRead = bucket.getRead()
    const canRead =
      bucketRead.length > 0 && this.session.ctx.roles.some((role) => bucketRead.includes(role))

    if (!fileSecurity && !canRead) {
      throw new UnauthorizedError('Unauthorized', { code: 'user_unauthorized' })
    }

    const session = fileSecurity && !canRead ? this.session : this.systemSession
    const file = await session.getDocument('files', fileId)
    if (file.empty()) {
      throw new NotFoundError('File not found', { code: 'storage_file_not_found' })
    }

    const filePath = file.get('path') ?? ''
    try {
      await this.device.exists(filePath)
    } catch {
      throw new NotFoundError(`File not found in ${filePath}`, {
        code: 'storage_file_not_found',
      })
    }

    const mimeType = file.get('mimeType') ?? ''
    const fileName = file.get('name') ?? ''
    const size = file.get('sizeOriginal') ?? 0

    // For non-image or large files, return a placeholder icon
    if (!mimeType.startsWith('image/') || size / 1024 > 10 * 1024) {
      const buffer = await this.device.read(filePath)
      return { buffer, mimeType: 'image/png', fileName }
    }

    const fileBuffer = await this.device.read(filePath)
    const image = new Bun.Image(fileBuffer)

    const { width, height, quality, opacity, rotation, output } = params

    if (width && height) {
      image.resize(width, height, { fit: 'inside' })
    } else if (width) {
      image.resize(width)
    } else if (height) {
      const meta = await image.metadata()
      const targetWidth = Math.max(1, Math.round((meta.width / (meta.height || 1)) * height))
      image.resize(targetWidth, height)
    }

    if (rotation) {
      image.rotate(rotation)
    }

    if (opacity !== undefined) {
      image.modulate({ brightness: opacity })
    }

    const outputFormat = (output ?? mimeType.split('/')[1] ?? 'jpeg').toLowerCase()
    if (outputFormat === 'png') {
      image.png()
    } else if (outputFormat === 'webp') {
      image.webp({ quality })
    } else if (outputFormat === 'avif') {
      image.avif({ quality })
    } else if (outputFormat === 'heic') {
      image.heic({ quality })
    } else {
      image.jpeg({ quality })
    }

    const buffer = await image.toBuffer()

    return { buffer, mimeType: `image/${outputFormat}`, fileName }
  }

  /**
   * Download or view a file (with optional Range support).
   * disposition: 'attachment' for download, 'inline' for view.
   */
  async serveFile(
    bucketId: string,
    fileId: string,
    ctx: FileContext,
    _disposition: 'attachment' | 'inline',
    rangeHeader?: string,
    readBufferLimit = 10 * 1024 * 1024,
    maxOutputChunkSize = 1024 * 1024,
  ): Promise<{
    buffer: Buffer
    mimeType: string
    fileName: string
    size: number
    start: number
    end: number
    partial: boolean
  }> {
    const bucket = await this.systemSession.getDocument('buckets', bucketId)

    if (bucket.empty() || (!bucket.get('enabled') && !ctx.isAPIUser && !ctx.isAdmin)) {
      throw new NotFoundError('Storage bucket not found', {
        code: 'storage_bucket_not_found',
      })
    }

    const fileSecurity = bucket.get('fileSecurity') ?? false
    const bucketRead = bucket.getRead()
    const canRead =
      bucketRead.length > 0 && this.session.ctx.roles.some((role) => bucketRead.includes(role))

    if (!fileSecurity && !canRead) {
      throw new UnauthorizedError('Unauthorized', { code: 'user_unauthorized' })
    }

    const session = fileSecurity && !canRead ? this.session : this.systemSession
    const file = await session.getDocument('files', fileId)
    if (file.empty()) {
      throw new NotFoundError('File not found', { code: 'storage_file_not_found' })
    }

    const filePath = file.get('path') ?? ''
    try {
      await this.device.exists(filePath)
    } catch {
      throw new NotFoundError(`File not found in ${filePath}`, {
        code: 'storage_file_not_found',
      })
    }

    const mimeType = file.get('mimeType') ?? ''
    const fileName = file.get('name') ?? ''
    const size = file.get('sizeOriginal') ?? 0

    let start = 0
    let end = size - 1
    let partial = false

    if (rangeHeader) {
      const [unit, range] = rangeHeader.split('=') as [string, string]
      if (unit !== 'bytes') {
        throw new BadRequestError('Invalid range unit', { code: 'storage_invalid_range' })
      }
      const [rangeStartStr, rangeEndStr] = range.split('-')
      start = Number(rangeStartStr)
      end = Number(rangeEndStr) || end

      if (start >= end || end >= size) {
        throw new BadRequestError('Invalid range', { code: 'storage_invalid_range' })
      }
      partial = true

      const source = await this.device.read(filePath)
      const buffer = source.subarray(start, end + 1)
      return { buffer, mimeType, fileName, size, start, end, partial }
    }

    if (size > readBufferLimit) {
      const totalChunks = Math.ceil(size / maxOutputChunkSize)
      const chunks: Buffer[] = []
      for (let i = 0; i < totalChunks; i++) {
        const offset = i * maxOutputChunkSize
        const chunkSize = Math.min(maxOutputChunkSize, size - offset)
        chunks.push(await this.device.read(filePath, offset, chunkSize))
      }
      const buffer = Buffer.concat(chunks)
      return { buffer, mimeType, fileName, size, start, end, partial }
    }

    const buffer = await this.device.read(filePath)
    return { buffer, mimeType, fileName, size, start, end, partial }
  }

  /**
   * Update file metadata (name, permissions).
   */
  async updateFile(
    bucketId: string,
    fileId: string,
    input: UpdateFileInput,
    ctx: FileContext,
  ): Promise<FileView> {
    const bucket = await this.systemSession.getDocument('buckets', bucketId)

    if (bucket.empty() || (!bucket.get('enabled') && !ctx.isAPIUser && !ctx.isAdmin)) {
      throw new NotFoundError('Storage bucket not found', {
        code: 'storage_bucket_not_found',
      })
    }

    const fileSecurity = bucket.get('fileSecurity') ?? false
    const bucketUpdate = bucket.getUpdate()
    const canUpdate =
      bucketUpdate.length > 0 && this.session.ctx.roles.some((role) => bucketUpdate.includes(role))

    if (!fileSecurity && !canUpdate) {
      throw new UnauthorizedError('Unauthorized', { code: 'user_unauthorized' })
    }

    const file = await this.systemSession.getDocument('files', fileId)
    if (file.empty()) {
      throw new NotFoundError('File not found', { code: 'storage_file_not_found' })
    }

    let permissions = Permission.aggregate(input.permissions ?? [], [
      PermissionType.Read,
      PermissionType.Update,
      PermissionType.Delete,
    ])
    if (!permissions) {
      permissions = file.getPermissions() ?? []
    }

    file.set('$permissions', permissions)
    if (input.name) {
      file.set('name', input.name)
    }

    const session = fileSecurity && !canUpdate ? this.session : this.systemSession
    const updated = await session.updateDocument('files', fileId, file)
    return formatFile(updated)
  }

  /**
   * Delete a file and remove it from the storage device.
   */
  async deleteFile(bucketId: string, fileId: string, ctx: FileContext): Promise<void> {
    const bucket = await this.systemSession.getDocument('buckets', bucketId)

    if (bucket.empty() || (!bucket.get('enabled') && !ctx.isAPIUser && !ctx.isAdmin)) {
      throw new NotFoundError('Storage bucket not found', {
        code: 'storage_bucket_not_found',
      })
    }

    const fileSecurity = bucket.get('fileSecurity') ?? false
    const bucketDelete = bucket.getDelete()
    const canDelete =
      bucketDelete.length > 0 && this.session.ctx.roles.some((role) => bucketDelete.includes(role))

    if (!fileSecurity && !canDelete) {
      throw new UnauthorizedError('Unauthorized', { code: 'user_unauthorized' })
    }

    const file = await this.systemSession.getDocument('files', fileId)
    if (file.empty()) {
      throw new NotFoundError('File not found', { code: 'storage_file_not_found' })
    }

    if (fileSecurity && !canDelete) {
      const fileDelete = file.getDelete()
      const canDeleteFile =
        fileDelete.length > 0 && this.session.ctx.roles.some((role) => fileDelete.includes(role))
      if (!canDeleteFile) {
        throw new UnauthorizedError('Unauthorized', { code: 'user_unauthorized' })
      }
    }

    const filePath = file.get('path') ?? ''
    let deviceDeleted = false

    if (file.get('chunksTotal') !== file.get('chunksUploaded')) {
      const uploadMeta = (file.get('metadata') as Record<string, unknown>) ?? {}
      deviceDeleted = await this.device.abort(filePath, (uploadMeta.uploadId as string) ?? '')
    } else {
      deviceDeleted = await this.device.delete(filePath)
    }

    if (!deviceDeleted) {
      throw new BadRequestError('Failed to delete file from device', {
        code: 'general_server_error',
      })
    }

    const session = fileSecurity && !canDelete ? this.session : this.systemSession
    const deleted = await session.deleteDocument('files', fileId)
    if (!deleted) {
      throw new BadRequestError('Failed to remove file from DB', {
        code: 'general_server_error',
      })
    }
  }
}
