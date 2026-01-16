import {
  Body,
  Controller,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'

import { ResponseInterceptor } from '@nuvix/core/resolvers'
import { StorageService } from './storage.service'
import { Models } from '@nuvix/core/helpers'
import { Database, Query as Queries } from '@nuvix/db'
import { ProjectGuard } from '@nuvix/core/resolvers'
import {
  ProjectDatabase,
  Namespace,
  Auth,
  AuthType,
  QueryFilter,
  QuerySearch,
  Project,
} from '@nuvix/core/decorators'

import {
  BucketParamsDTO,
  CreateBucketDTO,
  UpdateBucketDTO,
  UsageQueryDTO,
} from './DTO/bucket.dto'
import { ApiInterceptor } from '@nuvix/core/resolvers'
import { BucketsQueryPipe } from '@nuvix/core/pipes/queries'
import { Delete, Get, Post, Put } from '@nuvix/core'
import { IListResponse, IResponse } from '@nuvix/utils'
import type { BucketsDoc, ProjectsDoc } from '@nuvix/utils/types'

@Namespace('storage')
@UseGuards(ProjectGuard)
@Auth([AuthType.ADMIN, AuthType.KEY])
@Controller({ version: ['1'], path: 'storage' })
@UseInterceptors(ApiInterceptor, ResponseInterceptor)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('buckets', {
    summary: 'List buckets',
    scopes: 'buckets.read',
    model: { type: Models.BUCKET, list: true },
    sdk: {
      name: 'listBuckets',
      descMd: '/docs/references/storage/list-buckets.md',
    },
  })
  async getBuckets(
    @ProjectDatabase() db: Database,
    @QueryFilter(BucketsQueryPipe) queries?: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<BucketsDoc>> {
    return this.storageService.getBuckets(db, queries, search)
  }

  @Post('buckets', {
    summary: 'Create bucket',
    scopes: 'buckets.create',
    model: Models.BUCKET,
    audit: {
      key: 'bucket.create',
      resource: 'bucket/{res.$id}',
    },
    sdk: {
      name: 'createBucket',
      descMd: '/docs/references/storage/create-bucket.md',
    },
  })
  async createBucket(
    @ProjectDatabase() db: Database,
    @Body() createBucketDTO: CreateBucketDTO,
  ): Promise<IResponse<BucketsDoc>> {
    return this.storageService.createBucket(db, createBucketDTO)
  }

  @Get('buckets/:bucketId', {
    summary: 'Get bucket',
    scopes: 'buckets.read',
    model: Models.BUCKET,
    sdk: {
      name: 'getBucket',
      descMd: '/docs/references/storage/get-bucket.md',
    },
  })
  async getBucket(
    @ProjectDatabase() db: Database,
    @Param() { bucketId }: BucketParamsDTO,
  ): Promise<IResponse<BucketsDoc>> {
    return this.storageService.getBucket(db, bucketId)
  }

  @Put('buckets/:bucketId', {
    summary: 'Update bucket',
    scopes: 'buckets.update',
    model: Models.BUCKET,
    audit: {
      key: 'bucket.update',
      resource: 'bucket/{res.$id}',
    },
    sdk: {
      name: 'updateBucket',
      descMd: '/docs/references/storage/update-bucket.md',
    },
  })
  async updateBucket(
    @ProjectDatabase() db: Database,
    @Param() { bucketId }: BucketParamsDTO,
    @Body() createBucketDTO: UpdateBucketDTO,
  ): Promise<IResponse<BucketsDoc>> {
    return this.storageService.updateBucket(db, bucketId, createBucketDTO)
  }

  @Delete('buckets/:bucketId', {
    summary: 'Delete bucket',
    scopes: 'buckets.delete',
    model: Models.NONE,
    audit: {
      key: 'bucket.delete',
      resource: 'bucket/{params.bucketId}',
    },
    sdk: {
      name: 'deleteBucket',
      descMd: '/docs/references/storage/delete-bucket.md',
    },
  })
  async deleteBucket(
    @ProjectDatabase() db: Database,
    @Param() { bucketId }: BucketParamsDTO,
    @Project() project: ProjectsDoc,
  ): Promise<void> {
    return this.storageService.deleteBucket(db, bucketId, project)
  }

  @Get('usage', {
    summary: 'Get storage usage stats',
    scopes: 'files.read',
    model: Models.USAGE_STORAGE,
    sdk: {
      name: 'getUsage',
      descMd: '/docs/references/storage/get-usage.md',
    },
  })
  async getUsage(
    @ProjectDatabase() db: Database,
    @Query() { range }: UsageQueryDTO,
  ): Promise<IResponse<Record<string, any>>> {
    return this.storageService.getStorageUsage(db, range)
  }

  @Get(':bucket/usage', {
    summary: 'Get bucket usage stats',
    scopes: 'files.read',
    model: Models.USAGE_BUCKETS,
    sdk: {
      name: 'getBucketUsage',
      descMd: '/docs/references/storage/get-bucket-usage.md',
    },
  })
  async getBucketUsage(
    @ProjectDatabase() db: Database,
    @Param() { bucketId }: BucketParamsDTO,
    @Query() { range }: UsageQueryDTO,
  ): Promise<IResponse<Record<string, any>>> {
    return this.storageService.getBucketStorageUsage(db, bucketId, range)
  }
}
