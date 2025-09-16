import {
  Body,
  Controller,
  Delete,
  Get,
  Head,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseArrayPipe,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SchemasService } from './schemas.service';
import { ProjectGuard } from '@nuvix/core/resolvers/guards';
import {
  ResponseInterceptor,
  ApiInterceptor,
} from '@nuvix/core/resolvers/interceptors';
import {
  Auth,
  AuthType,
  CurrentSchema,
  Namespace,
  Scope,
  Sdk,
} from '@nuvix/core/decorators';
import { DataSource } from '@nuvix/pg';
import { ParseDuplicatePipe } from '@nuvix/core/pipes';
import { PermissionsDTO } from './DTO/permissions';

// Note: The `schemaId` parameter is used in hooks and must be included in all relevant routes.
@Controller({ version: ['1'], path: ['schemas/:schemaId', 'public'] })
@UseGuards(ProjectGuard)
@Namespace('schemas')
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class SchemasController {
  private readonly logger = new Logger(SchemasController.name);
  constructor(private readonly schemasService: SchemasService) {}

  @Get([':tableId', 'tables/:tableId'])
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
    @Query('limit', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    limit: number,
    @Query('offset', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    offset?: number,
  ) {
    return this.schemasService.select({
      table,
      pg,
      limit,
      offset,
      schema,
      url: request.raw.url || request.url,
    });
  }

  @Post([':tableId', 'tables/:tableId'])
  async insertIntoTable(
    @Param('tableId') table: string,
    @CurrentSchema() pg: DataSource,
    @Req() request: NuvixRequest,
    @Param('schemaId') schema: string = 'public',
    @Body() input: Record<string, any> | Record<string, any>[],
    @Query(
      'columns',
      ParseDuplicatePipe,
      new ParseArrayPipe({ items: String, optional: true }),
    )
    columns?: string[],
  ) {
    return this.schemasService.insert({
      pg,
      schema,
      table,
      input,
      columns,
      url: request.raw.url || request.url,
    });
  }

  @Patch([':tableId', 'tables/:tableId'])
  async updateTables(
    @Param('tableId') table: string,
    @CurrentSchema() pg: DataSource,
    @Req() request: NuvixRequest,
    @Param('schemaId') schema: string = 'public',
    @Body() input: Record<string, any>,
    @Query(
      'columns',
      ParseDuplicatePipe,
      new ParseArrayPipe({ items: String, optional: true }),
    )
    columns?: string[],
    @Query('limit', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    offset?: number,
    @Query('force', ParseDuplicatePipe, new ParseBoolPipe({ optional: true }))
    force: boolean = false,
  ) {
    return this.schemasService.update({
      pg,
      schema,
      table,
      input,
      columns,
      url: request.raw.url || request.url,
      limit,
      offset,
      force,
    });
  }

  @Put([':tableId', 'tables/:tableId'])
  async upsertTable(
    @Param('tableId') table: string,
    @CurrentSchema() pg: DataSource,
    @Req() request: NuvixRequest,
    @Param('schemaId') schema: string = 'public',
    @Body() input: Record<string, any> | Record<string, any>[],
    @Query('columns', new ParseArrayPipe({ items: String, optional: true }))
    columns?: string[],
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {}

  @Delete([':tableId', 'tables/:tableId'])
  async deleteTables(
    @Param('tableId') table: string,
    @CurrentSchema() pg: DataSource,
    @Req() request: NuvixRequest,
    @Param('schemaId') schema: string = 'public',
    @Query('limit', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    offset?: number,
    @Query('force', ParseDuplicatePipe, new ParseBoolPipe({ optional: true }))
    force: boolean = false,
  ) {
    return this.schemasService.delete({
      pg,
      schema,
      table,
      url: request.raw.url || request.url,
      limit,
      offset,
      force,
    });
  }

  // @Head(':tableId')
  // async tableMetadata() {

  // }

  @Post(['fn/:functionId', 'rpc/:functionId'])
  @HttpCode(HttpStatus.OK)
  async callFunction(
    @Param('functionId') functionName: string,
    @CurrentSchema() pg: DataSource,
    @Req() request: NuvixRequest,
    @Param('schemaId') schema: string = 'public',
    @Query('limit', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    offset?: number,
    @Body() args: Record<string, any> | any[] = [],
  ) {
    return this.schemasService.callFunction({
      pg,
      schema,
      functionName,
      url: request.raw.url || request.url,
      limit,
      offset,
      args,
    });
  }

  @Put(['tables/:tableId/permissions'])
  @Auth([AuthType.ADMIN, AuthType.KEY])
  manageTablePermissions(
    @CurrentSchema() pg: DataSource,
    @Param('schemaId') schema: string,
    @Param('tableId') tableId: string,
    @Body() body: PermissionsDTO,
  ) {
    return this.schemasService.updatePermissions({
      pg,
      permissions: body.permissions,
      tableId,
      schema,
    });
  }

  // TODO: check if schema type is not managed then throw error...
  @Put(['tables/:tableId/:rowId/permissions'])
  @Auth([AuthType.ADMIN, AuthType.KEY])
  manageRowPermissions(
    @CurrentSchema() pg: DataSource,
    @Param('tableId') tableId: string,
    @Param('rowId') rowId: number,
    @Param('schemaId') schema: string,
    @Body() body: PermissionsDTO,
  ) {
    return this.schemasService.updatePermissions({
      pg,
      permissions: body.permissions,
      tableId,
      schema,
      rowId,
    });
  }

  @Get(['tables/:tableId/permissions'])
  @Auth([AuthType.ADMIN, AuthType.KEY])
  getTablePermissions(
    @CurrentSchema() pg: DataSource,
    @Param('schemaId') schema: string,
    @Param('tableId') tableId: string,
  ) {
    return this.schemasService.getPermissions({
      pg,
      tableId,
      schema,
    });
  }

  @Get(['tables/:tableId/:rowId/permissions'])
  @Auth([AuthType.ADMIN, AuthType.KEY])
  getRowPermissions(
    @CurrentSchema() pg: DataSource,
    @Param('tableId') tableId: string,
    @Param('rowId') rowId: number,
    @Param('schemaId') schema: string,
  ) {
    return this.schemasService.getPermissions({
      pg,
      tableId,
      schema,
      rowId,
    });
  }
}
