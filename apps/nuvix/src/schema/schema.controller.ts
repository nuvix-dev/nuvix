import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
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
import { SelectNode, SelectParser } from '@nuvix/utils/query/select';
import { OrderParser, ParsedOrdering } from '@nuvix/utils/query/order';

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
  // @Scope('schema.read')
  @Sdk({
    name: 'queryTable',
    description: 'Query a table with optional filters',
    code: HttpStatus.OK,
  })
  async queryTable(
    @Param('tableId') table: string,
    @Req() request: NuvixRequest,
    @CurrentSchema() pg: DataSource,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 100,
  ) {
    const qb = pg.qb(table);

    const { filter, select, order } = this.getParamsFromUrl(request.raw.url);
    this.applySelectToQuery(qb, select);
    this.applyFiltersToQuery(qb, filter);
    this.applyOrderToQuery(qb, order);
    qb.limit(limit)

    this.logger.debug(qb.toSQL())

    return await qb;
  }

  @Get('query')
  test(
    @Req() request: NuvixRequest,
  ) {
    const urlParams = new URLSearchParams(request.raw.url);

    const the = SelectParser.parse(urlParams.get('select'))
    this.logger.debug(the, '<======== the Select');

    const the2 = OrderParser.parse(urlParams.get('order'))
    this.logger.debug(the2, '<======== the order')

    return urlParams;
  }

  private getParamsFromUrl(url: string): {
    filter?: Expression;
    select?: SelectNode[];
    order?: ParsedOrdering[];
  } {
    url = decodeURIComponent(url);
    const queryString = url.includes('?') ? url.split('?')[1] : '';
    const urlParams = new URLSearchParams(queryString);

    const _filter = urlParams.get('filter') || '';
    const filter = _filter ? parser.parse(_filter) : undefined;

    const _select = urlParams.get('select') || '';
    const select = _select ? SelectParser.parse(_select) : undefined;

    const _order = urlParams.get('order') || '';
    const order = _order ? OrderParser.parse(_order) : undefined;

    return { filter, select, order };
  }

  private applyFiltersToQuery<T>(
    qb: T,
    filters: Expression | undefined,
  ): T {
    if (filters) {
      this.astToQueryBuilder.applyFilters(filters, qb as any);
    }
    return qb;
  }

  private applySelectToQuery<T>(
    qb: T,
    select: SelectNode[] | undefined,
  ): T {
    if (select) {
      this.astToQueryBuilder.applySelect(select, qb as any);
    }
    return qb;
  }

  private applyOrderToQuery<T>(
    qb: T,
    order: ParsedOrdering[] | undefined,
  ): T {
    if (order) {
      this.astToQueryBuilder.applyOrder(order, qb as any);
    }
    return qb;
  }
}
