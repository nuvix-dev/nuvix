import {
  Body,
  Controller,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Delete, Get, Post } from '@nuvix/core'
import {
  Auth,
  AuthType,
  CurrentDatabase,
  CurrentSchemaType,
  Namespace,
  Project,
  QueryFilter,
} from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import { IndexesQueryPipe } from '@nuvix/core/pipes/queries'
import {
  ApiInterceptor,
  ResponseInterceptor,
  SchemaGuard,
} from '@nuvix/core/resolvers'
import type { Database, Query as Queries } from '@nuvix/db'
import { IListResponse, IResponse, SchemaType } from '@nuvix/utils'
import type { IndexesDoc, ProjectsDoc } from '@nuvix/utils/types'
import { CollectionParamsDTO } from '../DTO/collection.dto'
import { CreateIndexDTO, IndexParamsDTO } from './DTO/indexes.dto'
import { IndexesService } from './indexes.service'

@Controller({
  version: ['1'],
  path: 'schemas/:schemaId/collections/:collectionId/indexes',
})
@Namespace('schemas')
@UseGuards(SchemaGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.ADMIN, AuthType.KEY])
@CurrentSchemaType(SchemaType.Document)
export class IndexesController {
  constructor(private readonly indexesService: IndexesService) {}

  @Post('', {
    summary: 'Create index',
    scopes: ['collections.update', 'indexes.create'],
    model: Models.INDEX,
    audit: {
      key: 'index.create',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'createIndex',
      descMd: '/docs/references/schemas/collections/create-index.md',
      code: 202,
    },
  })
  async createIndex(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() input: CreateIndexDTO,
  ): Promise<IResponse<IndexesDoc>> {
    return this.indexesService.createIndex(collectionId, input, project)
  }

  @Get('', {
    summary: 'List indexes',
    scopes: ['collections.read', 'indexes.read'],
    model: { type: Models.INDEX, list: true },
    sdk: {
      name: 'listIndexes',
      descMd: '/docs/references/schemas/collections/list-indexes.md',
    },
  })
  async findIndexes(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @QueryFilter(IndexesQueryPipe) queries?: Queries[],
  ): Promise<IListResponse<IndexesDoc>> {
    return this.indexesService.getIndexes(collectionId, queries)
  }

  @Get(':key', {
    summary: 'Get index',
    scopes: ['collections.read', 'indexes.read'],
    model: Models.INDEX,
    sdk: {
      name: 'getIndex',
      descMd: '/docs/references/schemas/collections/get-index.md',
    },
  })
  async findIndex(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: IndexParamsDTO,
  ): Promise<IResponse<IndexesDoc>> {
    return this.indexesService.getIndex(collectionId, key)
  }

  @Delete(':key', {
    summary: 'Delete index',
    scopes: ['collections.update', 'indexes.delete'],
    model: Models.INDEX,
    audit: {
      key: 'index.delete',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'deleteIndex',
      descMd: '/docs/references/schemas/collections/delete-index.md',
      code: 202,
    },
  })
  async removeIndex(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: IndexParamsDTO,
  ): Promise<IndexesDoc> {
    return this.indexesService.deleteIndex(collectionId, key, project)
  }
}
