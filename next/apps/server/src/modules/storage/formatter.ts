import type { Doc } from '@nuvix/db'
import type { Buckets, Files } from '../../types/generated'
import type { BucketView, FileView } from './types'

export function formatBucket(doc: Doc<Buckets>): BucketView {
  const data = doc.toObject()
  return {
    $id: doc.getId(),
    name: String(data.name ?? ''),
    permissions: doc.getPermissions?.() ?? ((data.$permissions as string[]) || []),
    fileSecurity: data.fileSecurity !== false,
    enabled: data.enabled !== false,
    maximumFileSize: Number(data.maximumFileSize ?? 31457280),
    allowedFileExtensions: (data.allowedFileExtensions as string[]) || [],
    compression: String(data.compression ?? 'none'),
    encryption: Boolean(data.encryption),
    antivirus: Boolean(data.antivirus),
    $createdAt: data.$createdAt ? String(data.$createdAt) : undefined,
    $updatedAt: data.$updatedAt ? String(data.$updatedAt) : undefined,
  }
}

export function formatFile(doc: Doc<Files>): FileView {
  const data = doc.toObject()
  return {
    $id: doc.getId(),
    bucketId: String(data.bucketId ?? ''),
    name: String(data.name ?? ''),
    signature: String(data.signature ?? ''),
    mimeType: String(data.mimeType ?? 'application/octet-stream'),
    sizeOriginal: Number(data.sizeOriginal ?? 0),
    chunksTotal: Number(data.chunksTotal ?? 1),
    chunksUploaded: Number(data.chunksUploaded ?? 1),
    permissions: doc.getPermissions?.() ?? ((data.$permissions as string[]) || []),
    $createdAt: data.$createdAt ? String(data.$createdAt) : undefined,
    $updatedAt: data.$updatedAt ? String(data.$updatedAt) : undefined,
  }
}
