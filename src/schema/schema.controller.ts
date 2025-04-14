import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SchemaService } from './schema.service';
import { ProjectGuard } from 'src/core/resolvers/guards';
import {
  ResponseInterceptor,
  ApiInterceptor,
} from 'src/core/resolvers/interceptors';
import {
  CurrentSchema,
  Label,
  Namespace,
  Project,
  ProjectPg,
  ResModel,
  Scope,
} from 'src/core/decorators';
import { Document } from '@nuvix/database';
import { DataSource } from '@nuvix/pg';
import { Models } from 'src/core/helper';

// DTO's
import { CreateDocumentSchema, CreateSchema } from './DTO/create-schema.dto';

// Note: The `schemaId` parameter is used in hooks and must be included in all relevant routes.
@Controller({ version: ['1'], path: 'schemas' })
@UseGuards(ProjectGuard)
@Namespace() // TODO: --->
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class SchemaController {
  constructor(private readonly schemaService: SchemaService) { }

  @Post('document')
  @Scope('schema.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.SCHEMA)
  async createDocTypeSchema(
    @ProjectPg() pg: DataSource,
    @Project() project: Document,
    @Body() body: CreateDocumentSchema,
  ) {
    const result = await this.schemaService.createDocumentSchema(
      pg,
      project,
      body,
    );
    return result;
  }

  @Get()
  @Scope('schema.read')
  @Label('res.type', 'JSON')
  @Label('res.status', 'OK')
  @ResModel(Models.SCHEMA, { list: true })
  async getSchemas(@ProjectPg() pg: DataSource) {
    const schemas = await this.schemaService.getSchemas(pg);
    return schemas;
  }

  @Post()
  @Scope('schema.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.SCHEMA)
  async createSchema(@ProjectPg() pg: DataSource, @Body() body: CreateSchema) {
    const result = await this.schemaService.createSchema(pg, body);
    return result;
  }

  @Get(':schemaId')
  @Scope('schema.read')
  @Label('res.type', 'JSON')
  @Label('res.status', 'OK')
  @ResModel(Models.SCHEMA)
  async getSchema(@ProjectPg() pg: DataSource, @Param('schemaId') id: string) {
    const result = await this.schemaService.getSchema(pg, id);
    return result;
  }

  @Get(':schemaId/tables')
  @Scope('schema.read')
  @Label('res.type', 'JSON')
  @Label('res.status', 'OK')
  async getSchemaTables(
    @Param('schemaId') schema: string,
    @CurrentSchema() pg: DataSource,
  ) {
    const result = await this.schemaService.getTables(pg, schema);
    return result;
  }

  @Post(':schemaId/tables')
  @Scope('schema.tables.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  // @ResModel(Models.TABLE)
  async createSchemaTable(
    @Param('schemaId') schema: string,
    @CurrentSchema() pg: DataSource,
    @Body() body: any,
  ) {
    return await this.schemaService.createTable(pg, schema, body);
  }

  @Get(':schemaId/tables/:tableId')
  @Scope('schema.read')
  @Label('res.type', 'JSON')
  @Label('res.status', 'OK')
  async getSchemaTable(
    @Param('schemaId') schema: string,
    @Param('tableId') table: string,
    @CurrentSchema() pg: DataSource,
  ) {
    return await this.schemaService.getTable(pg, schema, table);
  }

  @Get(':schemaId/tables/:tableId/columns')
  @Scope('schema.read')
  @Label('res.type', 'JSON')
  @Label('res.status', 'OK')
  async getSchemaTableColumns(
    @Param('schemaId') schema: string,
    @Param('tableId') table: string,
    @CurrentSchema() pg: DataSource,
  ) {
    throw new Error('Method not implemented.');
  }

  @Get(':schemaId/table/:tableId')
  @Scope('schema.read')
  @Label('res.type', 'JSON')
  @Label('res.status', 'OK')
  async getRows(
    @Param('schemaId') schema: string,
    @Param('tableId') table: string,
    @CurrentSchema() pg: DataSource,
    @Query() query: any,
  ) {
    // console.log('parsedQuery', parsedQuery);
    // return await this.schemaService.getRows(pg, schema, table);
    return query;
  }

}
