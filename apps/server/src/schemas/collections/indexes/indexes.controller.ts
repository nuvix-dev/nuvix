import {
  Controller,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor'
import { IndexesService } from './indexes.service'
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard'
import { Models } from '@nuvix/core/helper/response.helper'
import type { Database, Query as Queries } from '@nuvix/db'
import {
  CurrentDatabase,
  Project,
} from '@nuvix/core/decorators/project.decorator'
import { Auth, AuthType, Namespace, QueryFilter } from '@nuvix/core/decorators'
import { CreateIndexDTO, IndexParamsDTO } from './DTO/indexes.dto'
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor'
import { DocSchemaGuard } from '@nuvix/core/resolvers/guards'
import type { IndexesDoc, ProjectsDoc } from '@nuvix/utils/types'
import { IndexesQueryPipe } from '@nuvix/core/pipes/queries'
import { ApiParam } from '@nestjs/swagger'
import { Delete, Get, Post } from '@nuvix/core'
import { CollectionParamsDTO } from '../DTO/collection.dto'
import { IListResponse, IResponse } from '@nuvix/utils'

@Controller({
  version: ['1'],
  path: 'schemas/:schemaId/collections/:collectionId/indexes',
})
@Namespace('schemas')
@UseGuards(ProjectGuard, DocSchemaGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.ADMIN, AuthType.KEY])
@ApiParam({
  name: 'schemaId',
  description: 'Schema ID. (See [Schemas](https://docs.nuvix.in/schemas)).',
  type: 'string',
  required: true,
})
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
      descMd: '/docs/references/databases/create-index.md',
    },
  })
  async createIndex(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() input: CreateIndexDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<IndexesDoc>> {
    return this.indexesService.createIndex(db, collectionId, input, project)
  }

  @Get('', {
    summary: 'List indexes',
    scopes: ['collections.read', 'indexes.read'],
    model: { type: Models.INDEX, list: true },
    sdk: {
      name: 'listIndexes',
      descMd: '/docs/references/databases/list-indexes.md',
    },
  })
  async findIndexes(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @QueryFilter(IndexesQueryPipe) queries?: Queries[],
  ): Promise<IListResponse<IndexesDoc>> {
    return this.indexesService.getIndexes(db, collectionId, queries)
  }

  @Get(':key', {
    summary: 'Get index',
    scopes: ['collections.read', 'indexes.read'],
    model: Models.INDEX,
    sdk: {
      name: 'getIndex',
      descMd: '/docs/references/databases/get-index.md',
    },
  })
  async findIndex(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: IndexParamsDTO,
  ): Promise<IResponse<IndexesDoc>> {
    return this.indexesService.getIndex(db, collectionId, key)
  }

  @Delete(':key', {
    summary: 'Delete index',
    scopes: ['collections.update', 'indexes.delete'],
    audit: {
      key: 'index.delete',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'deleteIndex',
      descMd: '/docs/references/databases/delete-index.md',
    },
  })
  async removeIndex(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: IndexParamsDTO,
    @Project() project: ProjectsDoc,
  ): Promise<void> {
    return this.indexesService.deleteIndex(db, collectionId, key, project)
  }
}
