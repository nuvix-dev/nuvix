import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { usageConfig } from '@nuvix/core/config'
import { Exception } from '@nuvix/core/extend/exception'
import type { DeletesJobData } from '@nuvix/core/resolvers'
import { StatsQueue } from '@nuvix/core/resolvers'
import {
  Authorization,
  Database,
  Doc,
  DuplicateException,
  ID,
  Permission,
  Query,
} from '@nuvix/db'
import {
  configuration,
  DeleteType,
  MetricFor,
  MetricPeriod,
  QueueFor,
} from '@nuvix/utils'
import collections from '@nuvix/utils/collections'
import { ProjectsDoc } from '@nuvix/utils/types'
import { Queue } from 'bullmq'
import { CreateBucketDTO, UpdateBucketDTO } from './DTO/bucket.dto'

@Injectable()
export class StorageService {
  constructor(
    @InjectQueue(QueueFor.DELETES)
    private readonly deletesQueue: Queue<DeletesJobData, unknown, DeleteType>,
  ) {}

  private getCollectionName(s: number) {
    return `bucket_${s}`
  }

  /**
   * Get buckets.
   */
  async getBuckets(queries: Query[] = [], search?: string) {
    if (search) {
      queries.push(Query.search('search', search))
    }
    const filterQueries = Query.groupByType(queries).filters

    return {
      data: await db.find('buckets', queries),
      total: await db.count(
        'buckets',
        filterQueries,
        configuration.limits.limitCount,
      ),
    }
  }

  /**
   * Create bucket.
   */
  async createBucket({
    bucketId,
    permissions: _perms,
    ...data
  }: CreateBucketDTO) {
    bucketId = bucketId === 'unique()' ? ID.unique() : bucketId
    const permissions = Permission.aggregate(_perms ?? [])

    try {
      const filesCollection = collections.bucket.files
      if (!filesCollection) {
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Files collection is not configured.',
        )
      }

      const attributes = filesCollection.attributes.map(
        attribute => new Doc(attribute),
      )
      const indexes = filesCollection.indexes?.map(index => new Doc(index))

      await db.createDocument(
        'buckets',
        new Doc({
          $id: bucketId,
          $collection: 'buckets',
          $permissions: permissions ?? [],
          name: data.name,
          maximumFileSize: data.maximumFileSize,
          allowedFileExtensions: data.allowedFileExtensions,
          fileSecurity: data.fileSecurity,
          enabled: data.enabled,
          compression: data.compression,
          encryption: data.encryption,
          antivirus: data.antivirus,
          search: [bucketId, data.name].join(' '),
        }),
      )

      const bucket = await db.getDocument('buckets', bucketId)
      await db.createCollection({
        id: this.getCollectionName(bucket.getSequence()),
        attributes,
        indexes,
        permissions: permissions ?? [],
        documentSecurity: data.fileSecurity,
      })

      return bucket
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.STORAGE_BUCKET_ALREADY_EXISTS)
      }
      throw error
    }
  }

  /**
   * Get a bucket.
   */
  async getBucket(id: string) {
    const bucket = await db.getDocument('buckets', id)

    if (bucket.empty()) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND)
    }

    return bucket
  }

  /**
   * Update a bucket.
   */
  async updateBucket(id: string, input: UpdateBucketDTO) {
    const bucket = await db.getDocument('buckets', id)

    if (bucket.empty()) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND)
    }

    const permissions = Permission.aggregate(
      input.permissions ?? bucket.getPermissions(),
    )!
    const maximumFileSize =
      input.maximumFileSize ??
      bucket.get('maximumFileSize', configuration.storage.limit)
    const allowedFileExtensions =
      input.allowedFileExtensions ?? bucket.get('allowedFileExtensions', [])
    const enabled = input.enabled ?? bucket.get('enabled', true)
    const encryption = input.encryption ?? bucket.get('encryption', true)
    const antivirus = input.antivirus ?? bucket.get('antivirus', true)

    const updatedBucket = await db.updateDocument(
      'buckets',
      id,
      bucket
        .set('name', input.name)
        .set('$permissions', permissions)
        .set('maximumFileSize', maximumFileSize)
        .set('allowedFileExtensions', allowedFileExtensions)
        .set('fileSecurity', input.fileSecurity)
        .set('enabled', enabled)
        .set('encryption', encryption)
        .set(
          'compression',
          input.compression ?? bucket.get('compression', 'none'),
        )
        .set('antivirus', antivirus),
    )

    await db.updateCollection({
      id: this.getCollectionName(bucket.getSequence()),
      permissions,
      documentSecurity: input.fileSecurity ?? bucket.get('fileSecurity', false),
    })

    return updatedBucket
  }

  /**
   * Delete a bucket.
   */
  async deleteBucket(id: string, project: ProjectsDoc) {
    const bucket = await db.getDocument('buckets', id)

    if (bucket.empty()) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND)
    }

    if (!(await db.deleteDocument('buckets', id))) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove bucket from DB',
      )
    }

    await this.deletesQueue.add(DeleteType.DOCUMENT, {
      document: bucket.clone(),
      project,
    })

    return
  }

  /**
   * Get Storage Usage.
   */
  async getStorageUsage(range = '7d') {
    const periods = usageConfig

    const stats: Record<string, any> = {}
    const usage: Record<string, any> = {}
    const days = periods[range as keyof typeof periods]
    const metrics = [
      MetricFor.BUCKETS,
      MetricFor.FILES,
      MetricFor.FILES_STORAGE,
    ]

    await Authorization.skip(async () => {
      for (const metric of metrics) {
        const result = await db.findOne('stats', qb =>
          qb.equal('metric', metric).equal('period', MetricPeriod.INF),
        )

        stats[metric] = { total: result.get('value') ?? 0, data: {} }
        const results = await db.find('stats', qb =>
          qb
            .equal('metric', metric)
            .equal('period', days.period)
            .limit(days.limit)
            .orderDesc('time'),
        )

        for (const res of results) {
          const time = StatsQueue.formatDate(
            days.period,
            res.get('time') as string,
          )!
          stats[metric].data[time] = {
            value: res.get('value'),
          }
        }
      }
    })

    for (const metric of metrics) {
      usage[metric] = { total: stats[metric].total, data: [] }
      let leap = Math.floor(Date.now() / 1000) - days.limit * days.factor

      while (leap < Math.floor(Date.now() / 1000)) {
        leap += days.factor

        const formatDate = StatsQueue.formatDate(
          days.period,
          new Date(leap * 1000),
        )!
        usage[metric].data.push({
          value: stats[metric].data[formatDate]?.value ?? 0,
          date: formatDate,
        })
      }
    }

    return {
      range,
      bucketsTotal: usage[MetricFor.BUCKETS]?.total,
      filesTotal: usage[MetricFor.FILES]?.total,
      filesStorageTotal: usage[MetricFor.FILES_STORAGE]?.total,
      buckets: usage[MetricFor.BUCKETS]?.data,
      files: usage[MetricFor.FILES]?.data,
      storage: usage[MetricFor.FILES_STORAGE]?.data,
    }
  }

  /**
   * Get Storage Usage of bucket.
   */
  async getBucketStorageUsage(bucketId: string, range = '7d') {
    const bucket = await db.getDocument('buckets', bucketId)

    if (bucket.empty()) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND)
    }

    const periods = usageConfig

    const stats: Record<string, any> = {}
    const usage: Record<string, any> = {}
    const days = periods[range as keyof typeof periods]
    const metrics = [
      MetricFor.BUCKET_ID_FILES.replace(
        '{bucketInternalId}',
        bucket.getSequence().toString(),
      ),
      MetricFor.BUCKET_ID_FILES_STORAGE.replace(
        '{bucketInternalId}',
        bucket.getSequence().toString(),
      ),
    ]

    await Authorization.skip(async () => {
      for (const metric of metrics) {
        const result = await db.findOne('stats', qb =>
          qb.equal('metric', metric).equal('period', MetricPeriod.INF),
        )

        stats[metric] = { total: result.get('value') ?? 0, data: {} }
        const results = await db.find('stats', qb =>
          qb
            .equal('metric', metric)
            .equal('period', days.period)
            .limit(days.limit)
            .orderDesc('time'),
        )

        for (const res of results) {
          const time = StatsQueue.formatDate(
            days.period,
            res.get('time') as string,
          )!
          stats[metric].data[time] = {
            value: res.get('value'),
          }
        }
      }
    })

    for (const metric of metrics) {
      usage[metric] = { total: stats[metric].total, data: [] }
      let leap = Math.floor(Date.now() / 1000) - days.limit * days.factor

      while (leap < Math.floor(Date.now() / 1000)) {
        leap += days.factor

        const formatDate = StatsQueue.formatDate(
          days.period,
          new Date(leap * 1000),
        )!
        usage[metric].data.push({
          value: stats[metric].data[formatDate]?.value ?? 0,
          date: formatDate,
        })
      }
    }

    return {
      range,
      filesTotal: usage[metrics[0]!]?.total,
      filesStorageTotal: usage[metrics[1]!]?.total,
      files: usage[metrics[0]!]?.data,
      storage: usage[metrics[1]!]?.data,
    }
  }
}
