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
import { ID } from '@nuvix/database';
import { DataSource } from '@nuvix/pg';
import { Parser } from '@nuvix/utils/query/parser';
import { ASTToQueryBuilder } from '@nuvix/utils/query/builder';
import { SelectParser } from '@nuvix/utils/query/select';
import { OrderParser } from '@nuvix/utils/query/order';
import {
  Expression,
  ParsedOrdering,
  SelectNode,
} from '@nuvix/utils/query/types';

// DTO's

// Note: The `schemaId` parameter is used in hooks and must be included in all relevant routes.
@Controller({ version: ['1'], path: ['schemas', 'db'] })
@UseGuards(ProjectGuard)
@Namespace() // TODO: --->
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class SchemaController {
  private readonly logger = new Logger(SchemaController.name);
  constructor(private readonly schemaService: SchemaService) {}

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
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    const qb = pg.qb(table).withSchema('public');
    const astToQueryBuilder = new ASTToQueryBuilder(qb, pg);

    const { filter, select, order } = this.getParamsFromUrl(
      request.raw.url,
      table,
    );
    astToQueryBuilder.applySelect(select);
    astToQueryBuilder.applyFilters(filter, {
      applyExtra: true,
      tableName: table,
    });
    astToQueryBuilder.applyOrder(order, table);
    qb.limit(limit);
    offset !== undefined && qb.offset(offset);

    this.logger.debug(qb.toSQL());

    return await qb;
  }

  private getParamsFromUrl(
    url: string,
    tableName: string,
  ): {
    filter?: Expression;
    select?: SelectNode[];
    order?: ParsedOrdering[];
  } {
    const queryString = url.includes('?') ? url.split('?')[1] : '';
    const urlParams = new URLSearchParams(queryString);

    const _filter = urlParams.get('filter') || '';
    const filter = _filter
      ? Parser.create({ tableName }).parse(_filter)
      : undefined;

    const _select = urlParams.get('select') || '';
    const select = _select
      ? new SelectParser({ tableName }).parse(_select)
      : undefined;

    const _order = urlParams.get('order') || '';
    const order = _order ? OrderParser.parse(_order) : undefined;

    return { filter, select, order };
  }
}
