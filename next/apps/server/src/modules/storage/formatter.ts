import type { BucketsDoc, FilesDoc } from '../../types/generated'

export interface BucketView {
  $id: string
  $createdAt: string
  $updatedAt: string
  $permissions: string[]
  fileSecurity: boolean
  name: string
  enabled: boolean
  maximumFileSize: number
  allowedFileExtensions: string[]
  compression: string
  encryption: boolean
  antivirus: boolean
}

export interface FileView {
  $id: string
  $createdAt: string
  $updatedAt: string
  $permissions: string[]
  bucketId: string
  name: string
  signature: string
  mimeType: string
  sizeOriginal: number
  sizeActual: number
  chunksTotal: number
  chunksUploaded: number
}

export interface StorageUsageView {
  range: string
  bucketsTotal: number
  filesTotal: number
  filesStorageTotal: number
  buckets: { value: number; date: string }[]
  files: { value: number; date: string }[]
  storage: { value: number; date: string }[]
}

export interface BucketUsageView {
  range: string
  filesTotal: number
  filesStorageTotal: number
  files: { value: number; date: string }[]
  storage: { value: number; date: string }[]
}

export function formatBucket(doc: BucketsDoc): BucketView {
  return {
    $id: doc.getId(),
    $createdAt: doc.createdAt()?.toISOString() ?? '',
    $updatedAt: doc.updatedAt()?.toISOString() ?? '',
    $permissions: doc.getPermissions() ?? [],
    fileSecurity: doc.get('fileSecurity') ?? false,
    name: doc.get('name') ?? '',
    enabled: doc.get('enabled') ?? true,
    maximumFileSize: doc.get('maximumFileSize') ?? 30_000_000,
    allowedFileExtensions: (doc.get('allowedFileExtensions') as string[]) ?? [],
    compression: doc.get('compression') ?? 'none',
    encryption: doc.get('encryption') ?? false,
    antivirus: doc.get('antivirus') ?? false,
  }
}

export function formatFile(doc: FilesDoc): FileView {
  return {
    $id: doc.getId(),
    $createdAt: doc.createdAt()?.toISOString() ?? '',
    $updatedAt: doc.updatedAt()?.toISOString() ?? '',
    $permissions: doc.getPermissions() ?? [],
    bucketId: doc.get('bucketId') ?? '',
    name: doc.get('name') ?? '',
    signature: doc.get('signature') ?? '',
    mimeType: doc.get('mimeType') ?? '',
    sizeOriginal: doc.get('sizeOriginal') ?? 0,
    sizeActual: doc.get('sizeActual') ?? 0,
    chunksTotal: doc.get('chunksTotal') ?? 1,
    chunksUploaded: doc.get('chunksUploaded') ?? 0,
  }
}
