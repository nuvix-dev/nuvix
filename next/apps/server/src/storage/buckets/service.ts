import { Doc, ID, KeyValidator, Permission, Query, type Session } from '@nuvix/db'
import type { Device } from '@nuvix/storage'
import { MetricFor } from '@nuvix/utils'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors'
import { parseUsageRange, readUsageSeries } from '../../stats/usage'
import type { Buckets } from '../../types/generated'
import {
  type BucketUsageView,
  type BucketView,
  formatBucket,
  type StorageUsageView,
} from '../formatter'

export interface CreateBucketInput {
  bucketId?: string
  name: string
  permissions?: string[]
  fileSecurity?: boolean
  enabled?: boolean
  maximumFileSize?: number
  allowedFileExtensions?: string[]
  compression?: string
  encryption?: boolean
  antivirus?: boolean
}

export interface UpdateBucketInput {
  name?: string
  permissions?: string[]
  fileSecurity?: boolean
  enabled?: boolean
  maximumFileSize?: number
  allowedFileExtensions?: string[]
  compression?: string
  encryption?: boolean
  antivirus?: boolean
}

export class StorageService {
  constructor(
    private readonly session: Session,
    private readonly device?: Device,
  ) {}

  /**
   * List all buckets with optional queries and search.
   */
  async getBuckets(
    queries: Query[] = [],
    search?: string,
  ): Promise<{ total: number; buckets: BucketView[] }> {
    const q = [...queries]
    if (search) {
      q.push(Query.search('search', search))
    }
    const filterQueries = Query.groupByType(q).filters

    const docs = await this.session.find('buckets', q)
    const total = await this.session.count('buckets', filterQueries)

    return {
      total,
      buckets: docs.map(formatBucket),
    }
  }

  /**
   * Create a new storage bucket.
   */
  async createBucket(input: CreateBucketInput): Promise<BucketView> {
    const bucketId = !input.bucketId || input.bucketId === 'unique()' ? ID.unique() : input.bucketId

    const validator = new KeyValidator(false)
    if (!validator.$valid(bucketId)) {
      throw new BadRequestError('Invalid bucket ID format', {
        code: 'invalid_params',
      })
    }

    const existing = await this.session.getDocument('buckets', bucketId)
    if (!existing.empty()) {
      throw new ConflictError('Bucket already exists', {
        code: 'storage_bucket_already_exists',
      })
    }

    const permissions = Permission.aggregate(input.permissions ?? []) ?? []

    const doc = new Doc<Buckets>({
      $id: bucketId,
      $permissions: permissions,
      name: input.name,
      fileSecurity: input.fileSecurity ?? false,
      enabled: input.enabled ?? true,
      maximumFileSize: input.maximumFileSize ?? 30_000_000,
      allowedFileExtensions: input.allowedFileExtensions ?? [],
      compression: input.compression ?? 'none',
      encryption: input.encryption ?? false,
      antivirus: input.antivirus ?? false,
      search: [bucketId, input.name].join(' '),
    })

    const created = await this.session.createDocument('buckets', doc)

    if (this.device) {
      try {
        await this.device.createDirectory(this.device.getPath(bucketId))
      } catch {
        // Directory may already exist — safe to ignore
      }
    }

    return formatBucket(created)
  }

  /**
   * Get a bucket by ID.
   */
  async getBucket(bucketId: string): Promise<BucketView> {
    const bucket = await this.session.getDocument('buckets', bucketId)
    if (bucket.empty()) {
      throw new NotFoundError('Storage bucket not found', {
        code: 'storage_bucket_not_found',
      })
    }
    return formatBucket(bucket)
  }

  /**
   * Update bucket settings.
   */
  async updateBucket(bucketId: string, input: UpdateBucketInput): Promise<BucketView> {
    const bucket = await this.session.getDocument('buckets', bucketId)
    if (bucket.empty()) {
      throw new NotFoundError('Storage bucket not found', {
        code: 'storage_bucket_not_found',
      })
    }

    const permissions = Permission.aggregate(input.permissions ?? bucket.getPermissions()) ?? []

    bucket.set('name', input.name ?? bucket.get('name'))
    bucket.set('$permissions', permissions)
    bucket.set('fileSecurity', input.fileSecurity ?? bucket.get('fileSecurity') ?? false)
    bucket.set('enabled', input.enabled ?? bucket.get('enabled') ?? true)
    bucket.set(
      'maximumFileSize',
      input.maximumFileSize ?? bucket.get('maximumFileSize') ?? 30_000_000,
    )
    bucket.set(
      'allowedFileExtensions',
      input.allowedFileExtensions ?? (bucket.get('allowedFileExtensions') as string[]) ?? [],
    )
    bucket.set('compression', input.compression ?? bucket.get('compression') ?? 'none')
    bucket.set('encryption', input.encryption ?? bucket.get('encryption') ?? false)
    bucket.set('antivirus', input.antivirus ?? bucket.get('antivirus') ?? false)

    const updated = await this.session.updateDocument('buckets', bucketId, bucket)
    return formatBucket(updated)
  }

  /**
   * Delete a bucket and queue its file cleanup.
   */
  async deleteBucket(bucketId: string): Promise<void> {
    const bucket = await this.session.getDocument('buckets', bucketId)
    if (bucket.empty()) {
      throw new NotFoundError('Storage bucket not found', {
        code: 'storage_bucket_not_found',
      })
    }

    // Delete all file records for this bucket
    const files = await this.session.find('files', [Query.equal('bucketId', [bucketId])])
    for (const f of files) {
      await this.session.deleteDocument('files', f.getId())
    }

    // Best-effort device cleanup
    if (this.device) {
      try {
        await this.device.deletePath(this.device.getPath(bucketId))
      } catch {
        // Ignore — files may already be gone
      }
    }

    await this.session.deleteDocument('buckets', bucketId)
  }

  /**
   * Get global storage usage stats.
   */
  async getStorageUsage(range = '30d'): Promise<StorageUsageView> {
    // v1 parity: usage reads the recorded `stats` rows, not live counts.
    const usageRange = parseUsageRange(range)
    const usage = await readUsageSeries(
      this.session,
      [MetricFor.BUCKETS, MetricFor.FILES, MetricFor.FILES_STORAGE],
      usageRange,
    )

    return {
      range: usageRange,
      bucketsTotal: usage[MetricFor.BUCKETS]?.total ?? 0,
      filesTotal: usage[MetricFor.FILES]?.total ?? 0,
      filesStorageTotal: usage[MetricFor.FILES_STORAGE]?.total ?? 0,
      buckets: usage[MetricFor.BUCKETS]?.data ?? [],
      files: usage[MetricFor.FILES]?.data ?? [],
      storage: usage[MetricFor.FILES_STORAGE]?.data ?? [],
    }
  }

  /**
   * Get usage stats for a specific bucket.
   */
  async getBucketStorageUsage(bucketId: string, range = '30d'): Promise<BucketUsageView> {
    const bucket = await this.session.getDocument('buckets', bucketId)
    if (bucket.empty()) {
      throw new NotFoundError('Storage bucket not found', {
        code: 'storage_bucket_not_found',
      })
    }

    // v1 parity: per-bucket metrics recorded under the
    // `{bucketInternalId}.files[.storage]` keys.
    const usageRange = parseUsageRange(range)
    const bucketInternalId = String(bucket.getSequence() ?? '')
    const metrics = [
      MetricFor.BUCKET_ID_FILES.replace('{bucketInternalId}', bucketInternalId),
      MetricFor.BUCKET_ID_FILES_STORAGE.replace('{bucketInternalId}', bucketInternalId),
    ]
    const usage = await readUsageSeries(this.session, metrics, usageRange)

    return {
      range: usageRange,
      filesTotal: usage[metrics[0]!]?.total ?? 0,
      filesStorageTotal: usage[metrics[1]!]?.total ?? 0,
      files: usage[metrics[0]!]?.data ?? [],
      storage: usage[metrics[1]!]?.data ?? [],
    }
  }
}
