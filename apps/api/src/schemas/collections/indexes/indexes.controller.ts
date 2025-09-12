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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { IndexesService } from './indexes.service';
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard';
import { Models } from '@nuvix/core/helper/response.helper';
import type { Database, Query as Queries } from '@nuvix-tech/db';
import {
  CurrentDatabase,
  Project,
} from '@nuvix/core/decorators/project.decorator';
import { Auth, AuthType, Namespace, ResModel } from '@nuvix/core/decorators';
import { CreateIndexDTO } from './DTO/indexes.dto';
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor';
import { DocSchemaGuard } from '@nuvix/core/resolvers/guards';
import type { ProjectsDoc } from '@nuvix/utils/types';
import { IndexesQueryPipe } from '@nuvix/core/pipes/queries';

@Controller({
  version: ['1'],
  path: 'schemas/:schemaId/collections/:collectionId/indexes',
})
@Namespace('schemas')
@UseGuards(ProjectGuard, DocSchemaGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.ADMIN, AuthType.KEY])
export class IndexesController {
  constructor(private readonly indexesService: IndexesService) {}

  @Post()
  @ResModel(Models.INDEX)
  async createIndex(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() input: CreateIndexDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.indexesService.createIndex(db, collectionId, input, project);
  }

  @Get()
  @ResModel({ type: Models.INDEX, list: true })
  async findIndexes(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Query('queries', IndexesQueryPipe) queries?: Queries[],
  ) {
    return this.indexesService.getIndexes(db, collectionId, queries);
  }

  @Get(':indexId')
  @ResModel(Models.INDEX)
  async findIndex(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('indexId') indexId: string,
  ) {
    return this.indexesService.getIndex(db, collectionId, indexId);
  }

  @Delete(':indexId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResModel(Models.NONE)
  async removeIndex(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('indexId') indexId: string,
    @Project() project: ProjectsDoc,
  ) {
    return this.indexesService.deleteIndex(db, collectionId, indexId, project);
  }
}
