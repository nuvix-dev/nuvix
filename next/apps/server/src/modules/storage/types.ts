export interface BucketView {
  $id: string
  name: string
  permissions: string[]
  fileSecurity: boolean
  enabled: boolean
  maximumFileSize: number
  allowedFileExtensions: string[]
  compression: string
  encryption: boolean
  antivirus: boolean
  $createdAt?: string
  $updatedAt?: string
}

export interface FileView {
  $id: string
  bucketId: string
  name: string
  signature: string
  mimeType: string
  sizeOriginal: number
  chunksTotal: number
  chunksUploaded: number
  permissions: string[]
  $createdAt?: string
  $updatedAt?: string
}

export interface CreateBucketInput {
  bucketId?: string
  name: string
  permissions?: string[]
  fileSecurity?: boolean
  enabled?: boolean
  maximumFileSize?: number
  allowedFileExtensions?: string[]
  compression?: 'none' | 'gzip' | 'zstd'
  encryption?: boolean
  antivirus?: boolean
}

export interface UpdateBucketInput {
  name: string
  permissions?: string[]
  fileSecurity?: boolean
  enabled?: boolean
  maximumFileSize?: number
  allowedFileExtensions?: string[]
  compression?: 'none' | 'gzip' | 'zstd'
  encryption?: boolean
  antivirus?: boolean
}

export interface CreateFileInput {
  fileId?: string
  name: string
  mimeType: string
  buffer: Buffer
  permissions?: string[]
}

export interface UpdateFileInput {
  name?: string
  permissions?: string[]
}

export interface StorageCallerAuth {
  isAdmin?: boolean
  isApiKey?: boolean
  userId?: string
  roles?: string[]
}
