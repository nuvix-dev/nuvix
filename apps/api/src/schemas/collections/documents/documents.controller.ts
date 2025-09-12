import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { DocumentsService } from './documents.service';
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard';
import { Models } from '@nuvix/core/helper/response.helper';
import type { Database, Query as Queries } from '@nuvix-tech/db';
import { ParseQueryPipe } from '@nuvix/core/pipes/query.pipe';
import { CurrentDatabase } from '@nuvix/core/decorators/project.decorator';
import {
  Auth,
  AuthType,
  Namespace,
  ResModel,
  AuthUser as User,
} from '@nuvix/core/decorators';

// DTOs
import { CreateDocumentDTO, UpdateDocumentDTO } from './DTO/document.dto';
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor';
import { DocSchemaGuard } from '@nuvix/core/resolvers/guards';
import type { UsersDoc } from '@nuvix/utils/types';

@Controller({
  version: ['1'],
  path: 'schemas/:schemaId/collections/:collectionId/documents',
})
@Namespace('schemas')
@UseGuards(ProjectGuard, DocSchemaGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ResModel({ type: Models.DOCUMENT, list: true })
  async findDocuments(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Query('queries', new ParseQueryPipe({ validate: false }))
    queries: Queries[],
  ) {
    return this.documentsService.getDocuments(db, collectionId, queries);
  }

  @Post()
  @ResModel(Models.DOCUMENT)
  async createDocument(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() document: CreateDocumentDTO,
    @User() user: UsersDoc,
  ) {
    return this.documentsService.createDocument(
      db,
      collectionId,
      document,
      user,
    );
  }

  @Get(':documentId')
  @ResModel(Models.DOCUMENT)
  async findDocument(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Query('queries', new ParseQueryPipe({ validate: false }))
    queries?: Queries[],
  ) {
    return this.documentsService.getDocument(
      db,
      collectionId,
      documentId,
      queries,
    );
  }

  @Patch(':documentId')
  @ResModel(Models.DOCUMENT)
  async updateDocument(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Body() document: UpdateDocumentDTO,
  ) {
    return this.documentsService.updateDocument(
      db,
      collectionId,
      documentId,
      document,
    );
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResModel(Models.NONE)
  async removeDocument(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.deleteDocument(db, collectionId, documentId);
  }

  @Get(':documentId/logs')
  @ResModel({ type: Models.LOG, list: true })
  @Auth([AuthType.ADMIN, AuthType.KEY])
  async findDocumentLogs(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Query('queries', ParseQueryPipe) queries?: Queries[],
  ) {
    return this.documentsService.getDocumentLogs(
      db,
      collectionId,
      documentId,
      queries,
    );
  }
}
