import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { Client } from './decorators';
import { PostgresMeta } from './lib';
import { DeparseDto, QueryDto } from './DTO/query.dto';
import * as Parser from './lib/Parser.js';
import { SchemaQueryDto } from './DTO/schema.dto';
import { SchemaIdParamDto } from './DTO/schema-id.dto';
import { SchemaCreateDto } from './DTO/schema-create.dto';
import { SchemaUpdateDto } from './DTO/schema-update.dto';
import { SchemaDeleteQueryDto } from './DTO/schema-delete.dto';
import { TableQueryDto } from './DTO/table.dto';
import { TableIdParamDto } from './DTO/table-id.dto';
import { TableCreateDto } from './DTO/table-create.dto';
import { TableUpdateDto } from './DTO/table-update.dto';
import { TableDeleteQueryDto } from './DTO/table-delete.dto';

@Controller({ path: 'meta', version: ['1'] })
export class PgMetaController {
  @Post('query')
  async query(@Client() client: PostgresMeta, @Body() body: QueryDto) {
    const { data } = await client.query(body.query, false);
    return data ?? [];
  }

  @Post('query/format')
  async format(@Body() body: QueryDto) {
    const { data } = await Parser.Format(body.query);
    return data;
  }

  @Post('query/parse')
  async parse(@Body() body: QueryDto) {
    const { data } = Parser.Parse(body.query);
    return data;
  }

  @Post('query/deparse')
  async deparse(@Body() body: DeparseDto) {
    const { data } = Parser.Deparse(body.ast);
    return data;
  }

  /*************************** Schemas *********************************/

  @Get('schemas')
  async getSchemas(
    @Query() query: SchemaQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const { includeSystemSchemas, limit, offset } = query;
    const { data } = await client.schemas.list({
      includeSystemSchemas,
      limit,
      offset,
    });
    return data ?? [];
  }

  @Get('schemas/:id')
  async getSchemaById(
    @Param() params: SchemaIdParamDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.schemas.retrieve({ id });
    return data;
  }

  @Post('schemas')
  async createSchema(
    @Body() body: SchemaCreateDto,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.schemas.create(body);
    return data;
  }

  @Patch('schemas/:id')
  async updateSchema(
    @Param() params: SchemaIdParamDto,
    @Body() body: SchemaUpdateDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.schemas.update(id, body);
    return data;
  }

  @Delete('schemas/:id')
  async deleteSchema(
    @Param() params: SchemaIdParamDto,
    @Query() query: SchemaDeleteQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { cascade } = query;
    const { data } = await client.schemas.remove(id, { cascade });
    return data;
  }

  /*************************** Tables *********************************/

  @Get('tables')
  async getTables(
    @Query() query: TableQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const {
      includeSystemSchemas,
      includedSchemas,
      excludedSchemas,
      limit,
      offset,
      includeColumns,
    } = query;
    const { data } = await client.tables.list({
      includeSystemSchemas,
      includedSchemas: includedSchemas?.split(','),
      excludedSchemas: excludedSchemas?.split(','),
      limit,
      offset,
      includeColumns,
    });
    return data ?? [];
  }

  @Get('tables/:id')
  async getTableById(
    @Param() params: TableIdParamDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.tables.retrieve({ id });
    return data;
  }

  @Post('tables')
  async createTable(
    @Body() body: TableCreateDto,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.tables.create(body);
    return data;
  }

  @Patch('tables/:id')
  async updateTable(
    @Param() params: TableIdParamDto,
    @Body() body: TableUpdateDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.tables.update(id, body);
    return data;
  }

  @Delete('tables/:id')
  async deleteTable(
    @Param() params: TableIdParamDto,
    @Query() query: TableDeleteQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { cascade } = query;
    const { data } = await client.tables.remove(id, { cascade });
    return data;
  }
}
