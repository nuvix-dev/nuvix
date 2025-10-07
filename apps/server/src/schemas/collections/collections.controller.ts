import {
  Controller,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common'
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor'
import { CollectionsService } from './collections.service'
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard'
import { Models } from '@nuvix/core/helper/response.helper'
import type { Database, Query as Queries } from '@nuvix/db'
import {
  CurrentDatabase,
  Project,
} from '@nuvix/core/decorators/project.decorator'
import {
  Auth,
  AuthType,
  CurrentSchemaType,
  Namespace,
  QueryFilter,
  QuerySearch,
} from '@nuvix/core/decorators'

// DTOs
import {
  CollectionParamsDTO,
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from './DTO/collection.dto'
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor'
import { SchemaGuard } from '@nuvix/core/resolvers/guards'
import type { CollectionsDoc, ProjectsDoc } from '@nuvix/utils/types'
import { CollectionsQueryPipe, LogsQueryPipe } from '@nuvix/core/pipes/queries'
import { Delete, Get, Post, Put } from '@nuvix/core'
import { IListResponse, IResponse, SchemaType } from '@nuvix/utils'
import { Exception } from '@nuvix/core/extend/exception'

@Namespace('schemas')
@Auth([AuthType.ADMIN, AuthType.KEY])
@UseGuards(ProjectGuard, SchemaGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Controller({ version: ['1'], path: 'schemas/:schemaId/collections' })
@CurrentSchemaType(SchemaType.Document)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get('', {
    summary: 'List collections',
    scopes: 'collections.read',
    model: { type: Models.COLLECTION, list: true },
    sdk: {
      name: 'listCollections',
      descMd: '/docs/references/schemas/collections/list-collections.md',
    },
  })
  async findCollections(
    @CurrentDatabase() db: Database,
    @QueryFilter(CollectionsQueryPipe) queries?: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<CollectionsDoc>> {
    return this.collectionsService.getCollections(db, queries, search)
  }

  @Post('', {
    summary: 'Create collection',
    scopes: 'collections.create',
    model: Models.COLLECTION,
    audit: {
      key: 'collection.create',
      resource: 'schema/{params.schemaId}/collection/{res.$id}',
    },
    sdk: {
      name: 'createCollection',
      descMd: '/docs/references/schemas/collections/create-collection.md',
    },
  })
  async createCollection(
    @CurrentDatabase() db: Database,
    @Body() createCollectionDTO: CreateCollectionDTO,
  ): Promise<IResponse<CollectionsDoc>> {
    return this.collectionsService.createCollection(db, createCollectionDTO)
  }

  @Get(':collectionId', {
    summary: 'Get collection',
    scopes: 'collections.read',
    model: Models.COLLECTION,
    sdk: {
      name: 'getCollection',
      descMd: '/docs/references/schemas/collections/get-collection.md',
    },
  })
  async findCollection(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
  ): Promise<IResponse<CollectionsDoc>> {
    return this.collectionsService.getCollection(db, collectionId)
  }

  @Put(':collectionId', {
    summary: 'Update collection',
    scopes: 'collections.update',
    model: Models.COLLECTION,
    audit: {
      key: 'collection.update',
      resource: 'schema/{params.schemaId}/collection/{res.$id}',
    },
    sdk: {
      name: 'updateCollection',
      descMd: '/docs/references/schemas/collections/update-collection.md',
    },
  })
  async updateCollection(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() updateCollectionDTO: UpdateCollectionDTO,
  ): Promise<IResponse<CollectionsDoc>> {
    return this.collectionsService.updateCollection(
      db,
      collectionId,
      updateCollectionDTO,
    )
  }

  @Delete(':collectionId', {
    summary: 'Delete collection',
    scopes: 'collections.delete',
    audit: {
      key: 'collection.delete',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'deleteCollection',
      descMd: '/docs/references/schemas/collections/delete-collection.md',
    },
  })
  async removeCollection(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Project() project: ProjectsDoc,
  ): Promise<void> {
    return this.collectionsService.removeCollection(db, collectionId, project)
  }

  @Get(':collectionId/usage', {
    summary: 'Get collection usage stats',
    scopes: ['collections.read'],
    model: Models.USAGE_COLLECTION,
    sdk: {
      name: 'getCollectionUsage',
      descMd: '/docs/references/schemas/collections/get-collection-usage.md',
    },
  })
  async getCollectionUsage(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Query('range') range?: string,
  ): Promise<IResponse<unknown>> {
    return this.collectionsService.getCollectionUsage(db, collectionId, range)
  }

  @Get(':collectionId/logs', {
    summary: 'List collection logs',
    scopes: 'collections.read',
    model: { type: Models.LOG, list: true },
    sdk: {
      name: 'listCollectionLogs',
      descMd: '/docs/references/schemas/collections/get-collection-logs.md',
    },
    docs: false,
  })
  async findCollectionLogs(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @QueryFilter(LogsQueryPipe) queries?: Queries[],
  ): Promise<IListResponse<unknown>> {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED)
    return this.collectionsService.getCollectionLogs(db, collectionId, queries)
  }
}
