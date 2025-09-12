import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Query,
  Put,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { CollectionsService } from './collections.service';
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard';
import { Models } from '@nuvix/core/helper/response.helper';
import type { Database, Query as Queries } from '@nuvix-tech/db';
import { ParseQueryPipe } from '@nuvix/core/pipes/query.pipe';
import {
  CurrentDatabase,
  Project,
} from '@nuvix/core/decorators/project.decorator';
import { Auth, AuthType, Namespace, ResModel } from '@nuvix/core/decorators';

// DTOs
import { CreateCollectionDTO, UpdateCollectionDTO } from './DTO/collection.dto';
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor';
import { DocSchemaGuard } from '@nuvix/core/resolvers/guards';
import type { ProjectsDoc } from '@nuvix/utils/types';
import { CollectionsQueryPipe } from '@nuvix/core/pipes/queries';

@Namespace('schemas')
@Auth([AuthType.ADMIN, AuthType.KEY])
@UseGuards(ProjectGuard, DocSchemaGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Controller({ version: ['1'], path: 'schemas/:schemaId/collections' })
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @ResModel({ type: Models.COLLECTION, list: true })
  async findCollections(
    @CurrentDatabase() db: Database,
    @Query('queries', CollectionsQueryPipe) queries?: Queries[],
    @Query('search') search?: string,
  ) {
    return this.collectionsService.getCollections(db, queries, search);
  }

  @Post()
  @ResModel(Models.COLLECTION)
  async createCollection(
    @CurrentDatabase() db: Database,
    @Body() createCollectionDTO: CreateCollectionDTO,
  ) {
    return this.collectionsService.createCollection(db, createCollectionDTO);
  }

  @Get(':collectionId')
  @ResModel(Models.COLLECTION)
  async findCollection(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
  ) {
    return this.collectionsService.getCollection(db, collectionId);
  }

  @Put(':collectionId')
  @ResModel(Models.COLLECTION)
  async updateCollection(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() updateCollectionDTO: UpdateCollectionDTO,
  ) {
    return this.collectionsService.updateCollection(
      db,
      collectionId,
      updateCollectionDTO,
    );
  }

  @Delete(':collectionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResModel(Models.NONE)
  async removeCollection(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.removeCollection(db, collectionId, project);
  }

  @Get(':collectionId/usage')
  @ResModel(Models.USAGE_COLLECTION)
  async getCollectionUsage(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Query('range') range?: string,
  ) {
    return this.collectionsService.getCollectionUsage(db, collectionId, range);
  }

  @Get(':collectionId/logs')
  @ResModel({ type: Models.LOG, list: true })
  async findCollectionLogs(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries?: Queries[],
  ) {
    return this.collectionsService.getCollectionLogs(db, collectionId, queries);
  }
}
