import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SchemaService } from './schema.service';
import { ProjectGuard } from '@nuvix/core/resolvers/guards';
import {
  ResponseInterceptor,
  ApiInterceptor,
} from '@nuvix/core/resolvers/interceptors';
import {
  CurrentSchema,
  Label,
  Namespace,
  Project,
  ProjectPg,
  ResModel,
  Scope,
} from '@nuvix/core/decorators';
import { Document, ID } from '@nuvix/database';
import { DataSource } from '@nuvix/pg';
import { parser } from '@nuvix/utils/query/parser';

// DTO's

// Note: The `schemaId` parameter is used in hooks and must be included in all relevant routes.
@Controller({ version: ['1'], path: 'schemas' })
@UseGuards(ProjectGuard)
@Namespace() // TODO: --->
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class SchemaController {
  private readonly logger = new Logger(SchemaController.name)
  constructor(private readonly schemaService: SchemaService) { }

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
    const qb = pg.qb()(table);
    return await qb.select('*').withSchema(schema).from(table);
  }

  @Post(':schemaId/table/:tableId')
  // @Scope('schema.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'OK')
  async insertRow(
    @Param('schemaId') schema: string,
    @Param('tableId') table: string,
    @CurrentSchema() pg: DataSource,
    @Body() body: any,
  ) {
    const qb = pg.qb()(table);
    return await qb
      .insert({
        ...body,
        _id: ID.unique(),
      })
      .withSchema(schema)
      .into(table)
      .returning('*');
  }

  @Delete(':schemaId/table/:tableId')
  // @Scope('schema.delete')
  @Label('res.type', 'JSON')
  @Label('res.status', 'NO_CONTENT')
  async deleteRow(
    @Param('schemaId') schema: string,
    @Param('tableId') table: string,
    @CurrentSchema() pg: DataSource,
    @Body() body: any,
  ) {
    const qb = pg.qb()(table);
    return await qb
      .delete()
      .withSchema(schema)
      .from(table)
      .where(body)
      .returning('*');
  }

  // its time to add a powerful route, THE MAIN QUERY ROUTE
  @Get('/query')
  async query(
    @Req() request: NuvixRequest
  ): Promise<any> {
    const queryString = request.raw.url.split('?')[1];
    this.logger.debug(queryString, '<========================[Query String]')

    // here we have to do the main thing with queries, i mean the parsing time
    // we have to parse very complex query structure, i mean the powerful parser

    const urlParams = new URLSearchParams(queryString);
    const filters = urlParams.get('filters') || '';

    this.logger.debug(filters, '<========================[Decoded Filters]')

    const startTime = performance.now();
    const parsedQuery = parser.parse(filters);
    const endTime = performance.now();

    this.logger.debug(`Parse time: ${endTime - startTime}ms`, '<========================[Parse Time]');

    return parsedQuery;
  }
}
