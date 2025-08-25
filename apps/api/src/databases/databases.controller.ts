import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { DatabasesService } from './databases.service';
import { ProjectGuard } from '@nuvix/core/resolvers/guards';
import {
  ResponseInterceptor,
  ApiInterceptor,
} from '@nuvix/core/resolvers/interceptors';
import { DataSource } from '@nuvix/pg';
import { Models } from '@nuvix/core/helper';
import {
  Project,
  ProjectPg,
  ResModel,
  Scope,
  Sdk,
} from '@nuvix/core/decorators';

// DTO's
import { CreateSchema } from './DTO/create-schema.dto';
import type { ProjectsDoc } from '@nuvix/utils/types';
import { SchemaType } from '@nuvix/utils';

@Controller({ version: ['1'], path: 'databases' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class DatabasesController {
  constructor(private readonly databaseService: DatabasesService) {}

  @Get('schemas')
  @Scope('schema.read')
  @Sdk({
    name: 'listSchemas',
    code: HttpStatus.OK,
  })
  @ResModel(Models.SCHEMA, { list: true })
  async getSchemas(@ProjectPg() pg: DataSource) {
    const schemas = await this.databaseService.getSchemas(pg);
    return schemas;
  }

  @Post('schemas')
  @Scope('schema.create')
  @Sdk({
    name: 'createSchema',
    code: HttpStatus.CREATED,
  })
  @ResModel(Models.SCHEMA)
  async createSchema(
    @ProjectPg() pg: DataSource,
    @Body() body: CreateSchema,
    @Project() project: ProjectsDoc,
  ) {
    const result = await (body.type !== SchemaType.Document
      ? this.databaseService.createSchema(pg, body)
      : this.databaseService.createDocumentSchema(pg, project, body));
    return result;
  }

  @Get('schemas/:schemaId')
  @Scope('schema.read')
  @Sdk({
    name: 'getSchema',
    code: HttpStatus.OK,
  })
  @ResModel(Models.SCHEMA)
  async getSchema(@ProjectPg() pg: DataSource, @Param('schemaId') id: string) {
    const result = await this.databaseService.getSchema(pg, id);
    return result;
  }
}
