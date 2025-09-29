import {
  Controller,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor'
import { DocumentsService } from './documents.service'
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard'
import { Models } from '@nuvix/core/helper/response.helper'
import type { Database, Doc, Query as Queries } from '@nuvix/db'
import { ParseQueryPipe } from '@nuvix/core/pipes/query.pipe'
import { CurrentDatabase } from '@nuvix/core/decorators/project.decorator'
import {
  AuthType,
  Namespace,
  QueryFilter,
  AuthUser as User,
} from '@nuvix/core/decorators'

// DTOs
import {
  CreateDocumentDTO,
  DocumentParamsDTO,
  UpdateDocumentDTO,
} from './DTO/document.dto'
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor'
import { DocSchemaGuard } from '@nuvix/core/resolvers/guards'
import type { UsersDoc } from '@nuvix/utils/types'
import { ApiParam } from '@nestjs/swagger'
import { Delete, Get, Patch, Post } from '@nuvix/core'
import { configuration, IListResponse, IResponse } from '@nuvix/utils'
import { CollectionParamsDTO } from '../DTO/collection.dto'
import { LogsQueryPipe } from '@nuvix/core/pipes/queries'
import { Exception } from '@nuvix/core/extend/exception'

@Controller({
  version: ['1'],
  path: 'schemas/:schemaId/collections/:collectionId/documents',
})
@Namespace('schemas')
@UseGuards(ProjectGuard, DocSchemaGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@ApiParam({
  name: 'schemaId',
  description: 'Schema ID. (See [Schemas](https://docs.nuvix.in/schemas)).',
  type: 'string',
  required: true,
})
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('', {
    summary: 'List documents',
    scopes: ['collections.read', 'documents.read'],
    model: { type: Models.DOCUMENT, list: true },
    sdk: {
      name: 'listDocuments',
      descMd: '/docs/references/databases/list-documents.md',
    },
  })
  async findDocuments(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @QueryFilter(new ParseQueryPipe({ validate: false }))
    queries: Queries[],
  ): Promise<IListResponse<Doc>> {
    return this.documentsService.getDocuments(db, collectionId, queries)
  }

  @Post('', {
    summary: 'Create document',
    scopes: ['collections.read', 'documents.create'],
    model: Models.DOCUMENT,
    throttle: {
      key: ({ user, ip }) => [`ip:${ip}`, `userId:${user.getId()}`].join(','),
      limit: configuration.limits.writeRateDefault * 2,
      ttl: configuration.limits.writeRatePeriodDefault,
    },
    audit: {
      key: 'document.create',
      resource: 'schema/{params.schemaId}/collection/{res.$id}',
    },
    sdk: {
      name: 'createDocument',
      descMd: '/docs/references/databases/create-document.md',
    },
  })
  async createDocument(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() document: CreateDocumentDTO,
    @User() user: UsersDoc,
  ): Promise<IResponse<Doc>> {
    return this.documentsService.createDocument(
      db,
      collectionId,
      document,
      user,
    )
  }

  @Get(':documentId', {
    summary: 'Get document',
    scopes: ['collections.read', 'documents.read'],
    model: Models.DOCUMENT,
    sdk: {
      name: 'getDocument',
      descMd: '/docs/references/databases/get-document.md',
    },
  })
  async findDocument(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, documentId }: DocumentParamsDTO,
    @QueryFilter(new ParseQueryPipe({ validate: false }))
    queries?: Queries[],
  ): Promise<IResponse<Doc>> {
    return this.documentsService.getDocument(
      db,
      collectionId,
      documentId,
      queries,
    )
  }

  @Patch(':documentId', {
    summary: 'Update document',
    scopes: ['collections.read', 'documents.update'],
    model: Models.DOCUMENT,
    throttle: {
      key: ({ user, ip }) => [`ip:${ip}`, `userId:${user.getId()}`].join(','),
      limit: configuration.limits.writeRateDefault * 2,
      ttl: configuration.limits.writeRatePeriodDefault,
    },
    audit: {
      key: 'document.update',
      resource: 'schema/{params.schemaId}/collection/{res.$id}',
    },
    sdk: {
      name: 'updateDocument',
      descMd: '/docs/references/databases/update-document.md',
    },
  })
  async updateDocument(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, documentId }: DocumentParamsDTO,
    @Body() document: UpdateDocumentDTO,
  ): Promise<IResponse<Doc>> {
    return this.documentsService.updateDocument(
      db,
      collectionId,
      documentId,
      document,
    )
  }

  @Delete(':documentId', {
    summary: 'Delete document',
    scopes: ['collections.read', 'documents.delete'],
    throttle: {
      key: ({ user, ip }) => [`ip:${ip}`, `userId:${user.getId()}`].join(','),
      limit: configuration.limits.writeRateDefault,
      ttl: configuration.limits.writeRatePeriodDefault,
    },
    audit: {
      key: 'document.delete',
      resource: 'schema/{params.schemaId}/collection/{res.$id}',
    },
    sdk: {
      name: 'deleteDocument',
      descMd: '/docs/references/databases/delete-document.md',
    },
  })
  async removeDocument(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, documentId }: DocumentParamsDTO,
  ): Promise<void> {
    return this.documentsService.deleteDocument(db, collectionId, documentId)
  }

  @Get(':documentId/logs', {
    summary: 'List document logs',
    scopes: ['collections.read', 'documents.read'],
    model: { type: Models.LOG, list: true },
    auth: [AuthType.ADMIN, AuthType.KEY],
    sdk: {
      name: 'listDocumentLogs',
      descMd: '/docs/references/databases/get-document-logs.md',
    },
    docs: false,
  })
  async findDocumentLogs(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, documentId }: DocumentParamsDTO,
    @QueryFilter(LogsQueryPipe) queries?: Queries[],
  ): Promise<IListResponse<unknown>> {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED)
    return this.documentsService.getDocumentLogs(
      db,
      collectionId,
      documentId,
      queries,
    )
  }
}
