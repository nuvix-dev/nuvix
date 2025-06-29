import {
  Body,
  Controller,
  Delete,
  Get,
  Head,
  HttpStatus,
  Logger,
  Param,
  ParseArrayPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
import { CurrentSchema, Namespace, Scope, Sdk } from '@nuvix/core/decorators';
import { DataSource } from '@nuvix/pg';

// DTO's

// Note: The `schemaId` parameter is used in hooks and must be included in all relevant routes.
@Controller({ version: ['1'] })
@UseGuards(ProjectGuard)
@Namespace() // TODO: --->
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class SchemaController {
  private readonly logger = new Logger(SchemaController.name);
  constructor(private readonly schemaService: SchemaService) {}

  @Get(['schemas/:schemaId/:tableId', 'schema/:tableId'])
  @Sdk({
    name: 'queryTable',
    description: 'Query a table with optional filters',
    code: HttpStatus.OK,
  })
  async queryTable(
    @Param('tableId') table: string,
    @Req() request: NuvixRequest,
    @CurrentSchema() pg: DataSource,
    @Param('schemaId') schema: string = 'public',
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 100,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    return await this.schemaService.select({
      table,
      pg,
      limit,
      offset,
      schema,
      url: request.raw.url,
    });
  }

  @Post(['schemas/:schemaId/:tableId', 'schema/:tableId'])
  async insertIntoTable(
    @Param('tableId') table: string,
    @CurrentSchema() pg: DataSource,
    @Body() input: Record<string, any> | Record<string, any>[],
    @Query('columns', new ParseArrayPipe({ items: String, optional: true }))
    columns?: string[],
  ) {
    return await this.schemaService.insert({
      pg,
      table,
      input,
      columns,
    });
  }

  @Patch(['schemas/:schemaId/:tableId', 'schema/:tableId'])
  async updateTables() {}

  @Put(['schemas/:schemaId/:tableId', 'schema/:tableId'])
  async upsertTable() {}

  @Delete(['schemas/:schemaId/:tableId', 'schema/:tableId'])
  async deleteTables() {}

  // @Head(['schemas/:schemaId/:tableId', 'schema/:tableId'])
  // async tableMetadata() {

  // }
}
