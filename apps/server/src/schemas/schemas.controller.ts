import {
  Body,
  Controller,
  Param,
  ParseArrayPipe,
  ParseBoolPipe,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { SchemasService } from './schemas.service'
import { ProjectGuard } from '@nuvix/core/resolvers/guards'
import {
  ResponseInterceptor,
  ApiInterceptor,
} from '@nuvix/core/resolvers/interceptors'
import {
  Auth,
  AuthType,
  CurrentSchema,
  Namespace,
} from '@nuvix/core/decorators'
import { DataSource } from '@nuvix/pg'
import { ParseDuplicatePipe } from '@nuvix/core/pipes'
import { PermissionsDTO } from './DTO/permissions.dto'
import { Delete, Get, Patch, Post, Put } from '@nuvix/core'
import {
  FunctionParamsDTO,
  RowParamsDTO,
  TableParamsDTO,
} from './DTO/table.dto'

// Note: The `schemaId` parameter is used in hooks and must be included in all relevant routes.
@Controller({ version: ['1'], path: ['schemas/:schemaId', 'public'] })
@UseGuards(ProjectGuard)
@Namespace('schemas')
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.ADMIN, AuthType.JWT, AuthType.SESSION, AuthType.SESSION])
export class SchemasController {
  constructor(private readonly schemasService: SchemasService) {}

  @Get([':tableId', 'tables/:tableId'], {
    summary: 'Query table data',
    description: 'Retrieve data from a specific table with optional pagination',
    scopes: 'schemas.tables.read',
  })
  async queryTable(
    @Param() { schemaId: schema = 'public', tableId: table }: TableParamsDTO,
    @Req() request: NuvixRequest,
    @CurrentSchema() pg: DataSource,
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
    })
  }

  @Post([':tableId', 'tables/:tableId'], {
    summary: 'Insert data into table',
    description: 'Insert one or more records into a specific table',
    scopes: 'schemas.tables.create',
  })
  async insertIntoTable(
    @CurrentSchema() pg: DataSource,
    @Req() request: NuvixRequest,
    @Param() { schemaId: schema = 'public', tableId: table }: TableParamsDTO,
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
    })
  }

  @Patch([':tableId', 'tables/:tableId'], {
    summary: 'Update table data',
    description:
      'Update existing records in a specific table with optional pagination and force flag',
    scopes: 'schemas.tables.update',
  })
  async updateTables(
    @Param() { schemaId: schema = 'public', tableId: table }: TableParamsDTO,
    @CurrentSchema() pg: DataSource,
    @Req() request: NuvixRequest,
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
    })
  }

  @Put([':tableId', 'tables/:tableId'], {
    summary: 'Upsert table data',
    description:
      'Insert or update records in a specific table (upsert operation)',
    scopes: ['schemas.tables.create', 'schemas.tables.update'],
    docs: false,
  })
  async upsertTable(
    @Param() { schemaId: schema = 'public', tableId: table }: TableParamsDTO,
    @CurrentSchema() pg: DataSource,
    @Req() request: NuvixRequest,
    @Body() input: Record<string, any> | Record<string, any>[],
    @Query('columns', new ParseArrayPipe({ items: String, optional: true }))
    columns?: string[],
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {}

  @Delete([':tableId', 'tables/:tableId'], {
    summary: 'Delete table data',
    description:
      'Delete records from a specific table with optional pagination and force flag',
  })
  async deleteTables(
    @Param() { schemaId: schema = 'public', tableId: table }: TableParamsDTO,
    @CurrentSchema() pg: DataSource,
    @Req() request: NuvixRequest,
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
    })
  }

  @Post(['fn/:functionId', 'rpc/:functionId'], {
    summary: 'Call database function',
    description: 'Execute a stored procedure or function in the database',
    sdk: {
      name: 'rpc',
      code: 200,
    },
  })
  async callFunction(
    @CurrentSchema() pg: DataSource,
    @Req() request: NuvixRequest,
    @Param() {
      schemaId: schema = 'public',
      functionId: functionName,
    }: FunctionParamsDTO,
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
    })
  }

  @Put(['tables/:tableId/permissions'], {
    summary: 'Update table permissions',
    description: 'Manage permissions for a specific table',
  })
  @Auth([AuthType.ADMIN, AuthType.KEY])
  manageTablePermissions(
    @CurrentSchema() pg: DataSource,
    @Param() { schemaId: schema = 'public', tableId }: TableParamsDTO,
    @Body() body: PermissionsDTO,
  ) {
    return this.schemasService.updatePermissions({
      pg,
      permissions: body.permissions,
      tableId,
      schema,
    })
  }

  @Put(['tables/:tableId/:rowId/permissions'], {
    summary: 'Update row permissions',
    description: 'Manage permissions for a specific row in a table',
  })
  @Auth([AuthType.ADMIN, AuthType.KEY])
  manageRowPermissions(
    @CurrentSchema() pg: DataSource,
    @Param() { schemaId: schema = 'public', tableId, rowId }: RowParamsDTO,
    @Body() body: PermissionsDTO,
  ) {
    return this.schemasService.updatePermissions({
      pg,
      permissions: body.permissions,
      tableId,
      schema,
      rowId,
    })
  }

  @Get(['tables/:tableId/permissions'], {
    summary: 'Get table permissions',
    description: 'Retrieve permissions for a specific table',
  })
  @Auth([AuthType.ADMIN, AuthType.KEY])
  getTablePermissions(
    @CurrentSchema() pg: DataSource,
    @Param() { schemaId: schema = 'public', tableId }: TableParamsDTO,
  ) {
    return this.schemasService.getPermissions({
      pg,
      tableId,
      schema,
    })
  }

  @Get(['tables/:tableId/:rowId/permissions'], {
    summary: 'Get row permissions',
    description: 'Retrieve permissions for a specific row in a table',
  })
  @Auth([AuthType.ADMIN, AuthType.KEY])
  getRowPermissions(
    @CurrentSchema() pg: DataSource,
    @Param() { schemaId: schema = 'public', tableId, rowId }: RowParamsDTO,
  ) {
    return this.schemasService.getPermissions({
      pg,
      tableId,
      schema,
      rowId,
    })
  }
}
