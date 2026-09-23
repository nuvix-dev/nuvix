import { ID } from '@nuvix/core'
import { Doc, Permission, Query, Role, type Session } from '@nuvix/db'
import type { Device } from '@nuvix/storage'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors'
import { formatBucket, formatFile } from './formatter'
import type {
  BucketView,
  CreateBucketInput,
  CreateFileInput,
  FileView,
  UpdateBucketInput,
  UpdateFileInput,
} from './types'

export interface PreviewOptions {
  width?: number
  height?: number
  rotation?: number
  output?: 'jpeg' | 'png' | 'webp' | 'avif'
}

export class StorageService {
  constructor(
    private readonly session: Session,
    private readonly device: Device,
  ) {}

  private getFilePath(bucketId: string, fileId: string): string {
    return `${bucketId}/${fileId}`
  }

  // --- Bucket Operations ---

  async listBuckets(
    options: { limit?: number; offset?: number; search?: string } = {},
  ): Promise<{ buckets: BucketView[]; total: number }> {
    const limit = options.limit ?? 25
    const offset = options.offset ?? 0
    const queries: Query[] = [
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc('$createdAt'),
    ]

    if (options.search) {
      queries.push(Query.search('search', options.search))
    }

    const docs = await this.session.find('buckets', queries)
    const countQueries = options.search ? [Query.search('search', options.search)] : []
    const total = await this.session.count('buckets', countQueries)

    return {
      buckets: docs.map(formatBucket),
      total,
    }
  }

  async getBucket(bucketId: string): Promise<BucketView> {
    const doc = await this.session.getDocument('buckets', bucketId).catch(() => null)
    if (!doc || doc.empty()) {
      throw new NotFoundError('Bucket', { code: 'bucket_not_found' })
    }
    return formatBucket(doc)
  }

  async createBucket(input: CreateBucketInput, userId?: string): Promise<BucketView> {
    const bucketId = ID.auto(input.bucketId)

    const existing = await this.session.getDocument('buckets', bucketId).catch(() => null)
    if (existing && !existing.empty()) {
      throw new ConflictError('Bucket already exists', { code: 'bucket_already_exists' })
    }

    let permissions = input.permissions
    if (!permissions || permissions.length === 0) {
      if (userId) {
        permissions = [
          Permission.read(Role.any()).toString(),
          Permission.create(Role.user(userId)).toString(),
          Permission.update(Role.user(userId)).toString(),
          Permission.delete(Role.user(userId)).toString(),
        ]
      } else {
        permissions = [Permission.read(Role.any()).toString()]
      }
    }

    const doc = new Doc({
      $id: bucketId,
      $permissions: permissions,
      name: input.name,
      fileSecurity: input.fileSecurity !== false,
      enabled: input.enabled !== false,
      maximumFileSize: input.maximumFileSize ?? 31457280,
      allowedFileExtensions: input.allowedFileExtensions ?? [],
      compression: input.compression ?? 'none',
      encryption: input.encryption ?? false,
      antivirus: input.antivirus ?? false,
      search: `${bucketId} ${input.name}`,
    })

    const created = await this.session.createDocument('buckets', doc)
    return formatBucket(created)
  }

  async updateBucket(bucketId: string, input: UpdateBucketInput): Promise<BucketView> {
    const existing = await this.session.getDocument('buckets', bucketId).catch(() => null)
    if (!existing || existing.empty()) {
      throw new NotFoundError('Bucket', { code: 'bucket_not_found' })
    }

    const updateDoc = new Doc({
      ...existing.toObject(),
      name: input.name,
      ...(input.permissions !== undefined ? { $permissions: input.permissions } : {}),
      ...(input.fileSecurity !== undefined ? { fileSecurity: input.fileSecurity } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.maximumFileSize !== undefined ? { maximumFileSize: input.maximumFileSize } : {}),
      ...(input.allowedFileExtensions !== undefined
        ? { allowedFileExtensions: input.allowedFileExtensions }
        : {}),
      ...(input.compression !== undefined ? { compression: input.compression } : {}),
      ...(input.encryption !== undefined ? { encryption: input.encryption } : {}),
      ...(input.antivirus !== undefined ? { antivirus: input.antivirus } : {}),
      search: `${bucketId} ${input.name}`,
    })

    const updated = await this.session.updateDocument('buckets', bucketId, updateDoc)
    return formatBucket(updated)
  }

  async deleteBucket(bucketId: string): Promise<void> {
    const existing = await this.session.getDocument('buckets', bucketId).catch(() => null)
    if (!existing || existing.empty()) {
      throw new NotFoundError('Bucket', { code: 'bucket_not_found' })
    }

    const files = await this.session.find('files', [
      Query.equal('bucketId', [bucketId]),
      Query.limit(1000),
    ])

    for (const file of files) {
      const filePath = this.getFilePath(bucketId, file.getId())
      await this.device.delete(filePath).catch(() => {})
      await this.session.deleteDocument('files', file.getId()).catch(() => {})
    }

    await this.session.deleteDocument('buckets', bucketId)
  }

  // --- File Operations ---

  async listFiles(
    bucketId: string,
    options: {
      limit?: number
      offset?: number
      search?: string
    } = {},
  ): Promise<{ files: FileView[]; total: number }> {
    await this.getBucket(bucketId)

    const limit = options.limit ?? 25
    const offset = options.offset ?? 0
    const queries: Query[] = [
      Query.equal('bucketId', [bucketId]),
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc('$createdAt'),
    ]

    if (options.search) {
      queries.push(Query.search('name', options.search))
    }

    const docs = await this.session.find('files', queries)
    const countQueries = [
      Query.equal('bucketId', [bucketId]),
      ...(options.search ? [Query.search('name', options.search)] : []),
    ]
    const total = await this.session.count('files', countQueries)

    return {
      files: docs.map(formatFile),
      total,
    }
  }

  async getFile(bucketId: string, fileId: string): Promise<FileView> {
    await this.getBucket(bucketId)

    const doc = await this.session.getDocument('files', fileId).catch(() => null)
    if (!doc || doc.empty() || doc.get('bucketId') !== bucketId) {
      throw new NotFoundError('File', { code: 'file_not_found' })
    }
    return formatFile(doc)
  }

  async createFile(bucketId: string, input: CreateFileInput, userId?: string): Promise<FileView> {
    const bucket = await this.getBucket(bucketId)
    if (!bucket.enabled) {
      throw new BadRequestError('Bucket is disabled', { code: 'bucket_is_disabled' })
    }

    if (input.buffer.length > bucket.maximumFileSize) {
      throw new BadRequestError('File size exceeds maximum allowed size', {
        code: 'bucket_file_size_exceeded',
      })
    }

    if (bucket.allowedFileExtensions.length > 0) {
      const ext = input.name.split('.').pop()?.toLowerCase() || ''
      const allowed = bucket.allowedFileExtensions.map((e) => e.toLowerCase())
      if (!allowed.includes(ext)) {
        throw new BadRequestError(`File extension .${ext} is not allowed in this bucket`, {
          code: 'bucket_file_extension_unsupported',
        })
      }
    }

    const fileId = ID.auto(input.fileId)
    const existing = await this.session.getDocument('files', fileId).catch(() => null)
    if (existing && !existing.empty()) {
      throw new ConflictError('File already exists', { code: 'file_already_exists' })
    }

    const hasher = new Bun.CryptoHasher('sha256')
    hasher.update(input.buffer)
    const signature = hasher.digest('hex')

    const filePath = this.getFilePath(bucketId, fileId)
    await this.device.write(filePath, input.buffer, input.mimeType)

    let permissions = input.permissions
    if (!permissions || permissions.length === 0) {
      if (userId) {
        permissions = [
          Permission.read(Role.any()).toString(),
          Permission.update(Role.user(userId)).toString(),
          Permission.delete(Role.user(userId)).toString(),
        ]
      } else {
        permissions = [Permission.read(Role.any()).toString()]
      }
    }

    const doc = new Doc({
      $id: fileId,
      $permissions: permissions,
      bucketId,
      name: input.name,
      signature,
      mimeType: input.mimeType,
      sizeOriginal: input.buffer.length,
      chunksTotal: 1,
      chunksUploaded: 1,
      path: filePath,
    })

    const created = await this.session.createDocument('files', doc)
    return formatFile(created)
  }

  async readFile(bucketId: string, fileId: string): Promise<{ file: FileView; buffer: Buffer }> {
    const file = await this.getFile(bucketId, fileId)
    const filePath = this.getFilePath(bucketId, fileId)
    const buffer = await this.device.read(filePath)
    return { file, buffer }
  }

  async previewFile(
    bucketId: string,
    fileId: string,
    options: PreviewOptions = {},
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const { file, buffer } = await this.readFile(bucketId, fileId)

    if (!file.mimeType.startsWith('image/')) {
      return { buffer, mimeType: file.mimeType }
    }

    if (!options.width && !options.height && !options.rotation && !options.output) {
      return { buffer, mimeType: file.mimeType }
    }

    const img = new Bun.Image(buffer)
    if (options.width || options.height) {
      img.resize(options.width ?? options.height!, options.height)
    }
    if (options.rotation) {
      img.rotate(options.rotation)
    }

    if (options.output === 'png') {
      img.png()
      return { buffer: await img.buffer(), mimeType: 'image/png' }
    }
    if (options.output === 'webp') {
      img.webp()
      return { buffer: await img.buffer(), mimeType: 'image/webp' }
    }
    if (options.output === 'avif') {
      img.avif()
      return { buffer: await img.buffer(), mimeType: 'image/avif' }
    }

    img.jpeg()
    return { buffer: await img.buffer(), mimeType: 'image/jpeg' }
  }

  async updateFile(bucketId: string, fileId: string, input: UpdateFileInput): Promise<FileView> {
    await this.getBucket(bucketId)

    const existing = await this.session.getDocument('files', fileId).catch(() => null)
    if (!existing || existing.empty() || existing.get('bucketId') !== bucketId) {
      throw new NotFoundError('File', { code: 'file_not_found' })
    }

    const updateDoc = new Doc({
      ...existing.toObject(),
      ...(input.name ? { name: input.name } : {}),
      ...(input.permissions !== undefined ? { $permissions: input.permissions } : {}),
    })

    const updated = await this.session.updateDocument('files', fileId, updateDoc)
    return formatFile(updated)
  }

  async deleteFile(bucketId: string, fileId: string): Promise<void> {
    await this.getBucket(bucketId)

    const existing = await this.session.getDocument('files', fileId).catch(() => null)
    if (!existing || existing.empty() || existing.get('bucketId') !== bucketId) {
      throw new NotFoundError('File', { code: 'file_not_found' })
    }

    const filePath = this.getFilePath(bucketId, fileId)
    await this.device.delete(filePath).catch(() => {})
    await this.session.deleteDocument('files', fileId)
  }
}
