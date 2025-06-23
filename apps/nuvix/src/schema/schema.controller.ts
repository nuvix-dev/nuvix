import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
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
  Scope,
  Sdk,
} from '@nuvix/core/decorators';
import { Document, ID } from '@nuvix/database';
import { DataSource } from '@nuvix/pg';
import { Expression, parser } from '@nuvix/utils/query/parser';
import { ASTToQueryBuilder } from '@nuvix/utils/query/builder';

// DTO's

// Note: The `schemaId` parameter is used in hooks and must be included in all relevant routes.
@Controller({ version: ['1'], path: ['schemas', 'db'] })
@UseGuards(ProjectGuard)
@Namespace() // TODO: --->
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class SchemaController {
  private readonly logger = new Logger(SchemaController.name);
  private readonly astToQueryBuilder = new ASTToQueryBuilder();

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
    const qb = pg.qb(table);
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
    const qb = pg.qb(table);
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
    const qb = pg.qb(table);
    return await qb
      .delete()
      .withSchema(schema)
      .from(table)
      .where(body)
      .returning('*');
  }

  @Get(':tableId')
  @Scope('schema.read')
  @Sdk({
    name: 'queryTable',
    description: 'Query a table with optional filters',
    code: HttpStatus.OK,
  })
  async queryTable(
    @Param('tableId') table: string,
    @Req() request: NuvixRequest,
    @CurrentSchema() pg: DataSource,
    @Query() query: any = {},
  ) {
    const qb = pg.qb(table).select('*');

    const filters = this.getFiltersFromUrl(request.raw.url);
    this.applyFiltersToQuery(qb, filters);

    return await qb;
  }

  private getFiltersFromUrl(query: string): Expression | undefined {
    const urlParams = new URLSearchParams(query);
    const filters = urlParams.get('filters') || '';
    return filters ? parser.parse(filters) : undefined;
  }

  private applyFiltersToQuery<T>(
    qb: T,
    filters: Expression | undefined,
  ): T {
    if (filters) {
      this.astToQueryBuilder.convert(filters, qb as any);
    }
    return qb;
  }
}
