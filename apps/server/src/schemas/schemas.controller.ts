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
import { ProjectGuard, SchemaGuard } from '@nuvix/core/resolvers/guards'
import {
  ResponseInterceptor,
  ApiInterceptor,
} from '@nuvix/core/resolvers/interceptors'
import {
  AuthType,
  CurrentSchema,
  CurrentSchemaType,
  Namespace,
  Project,
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
import type { ProjectsDoc } from '@nuvix/utils/types'
import { Context, SchemaType } from '@nuvix/utils'

// Note: The `schemaId` parameter is used in hooks and must be included in all relevant routes.
@Controller({ version: ['1'], path: ['schemas/:schemaId', 'public'] })
@UseGuards(ProjectGuard, SchemaGuard)
@Namespace('schemas')
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@CurrentSchemaType([SchemaType.Managed, SchemaType.Unmanaged])
export class SchemasController {
  constructor(private readonly schemasService: SchemasService) {}

  @Get(['tables/:tableId'], {
    summary: 'Query table data',
    description: 'Retrieve data from a specific table with optional pagination',
    scopes: 'schemas.tables.read',
  })
  async queryTable(
    @Param() { schemaId: schema = 'public', tableId: table }: TableParamsDTO,
    @Req() request: NuvixRequest,
    @CurrentSchema() pg: DataSource,
    @Project() project: ProjectsDoc,
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
      project,
      context: request[Context.AuthMeta],
    })
  }

  @Post(['tables/:tableId'], {
    summary: 'Insert data into table',
    description: 'Insert one or more records into a specific table',
    scopes: 'schemas.tables.create',
  })
  async insertIntoTable(
    @CurrentSchema() pg: DataSource,
    @Req() request: NuvixRequest,
    @Param() { schemaId: schema = 'public', tableId: table }: TableParamsDTO,
    @Body() input: Record<string, any> | Record<string, any>[],
    @Project() project: ProjectsDoc,
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
      project,
    })
  }

  @Patch(['tables/:tableId'], {
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
    @Project() project: ProjectsDoc,
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
      project,
    })
  }

  @Put(['tables/:tableId'], {
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

  @Delete(['tables/:tableId'], {
    summary: 'Delete table data',
    scopes: 'schemas.tables.delete',
    description:
      'Delete records from a specific table with optional pagination and force flag',
  })
  async deleteTables(
    @Param() { schemaId: schema = 'public', tableId: table }: TableParamsDTO,
    @CurrentSchema() pg: DataSource,
    @Req() request: NuvixRequest,
    @Project() project: ProjectsDoc,
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
      project,
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
    @Project() project: ProjectsDoc,
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
      project,
    })
  }

  @Put(['tables/:tableId/permissions'], {
    summary: 'Update table permissions',
    description: 'Manage permissions for a specific table',
    auth: [AuthType.ADMIN, AuthType.KEY],
  })
  @CurrentSchemaType(SchemaType.Managed)
  manageTablePermissions(
    @CurrentSchema() pg: DataSource,
    @Param() { schemaId: schema = 'public', tableId }: TableParamsDTO,
    @Body() body: PermissionsDTO,
    @Project() project: ProjectsDoc,
  ): Promise<string[]> {
    return this.schemasService.updatePermissions({
      pg,
      permissions: body.permissions,
      tableId,
      schema,
      project,
    })
  }

  @Put(['tables/:tableId/:rowId/permissions'], {
    summary: 'Update row permissions',
    description: 'Manage permissions for a specific row in a table',
    auth: [AuthType.ADMIN, AuthType.KEY],
  })
  @CurrentSchemaType(SchemaType.Managed)
  manageRowPermissions(
    @CurrentSchema() pg: DataSource,
    @Param() { schemaId: schema = 'public', tableId, rowId }: RowParamsDTO,
    @Body() body: PermissionsDTO,
    @Project() project: ProjectsDoc,
  ): Promise<string[]> {
    return this.schemasService.updatePermissions({
      pg,
      permissions: body.permissions,
      tableId,
      schema,
      rowId,
      project,
    })
  }

  @Get(['tables/:tableId/permissions'], {
    summary: 'Get table permissions',
    description: 'Retrieve permissions for a specific table',
    auth: [AuthType.ADMIN, AuthType.KEY],
  })
  @CurrentSchemaType(SchemaType.Managed)
  getTablePermissions(
    @CurrentSchema() pg: DataSource,
    @Param() { schemaId: schema = 'public', tableId }: TableParamsDTO,
    @Project() project: ProjectsDoc,
  ): Promise<string[]> {
    return this.schemasService.getPermissions({
      pg,
      tableId,
      schema,
      project,
    })
  }

  @Get(['tables/:tableId/:rowId/permissions'], {
    summary: 'Get row permissions',
    description: 'Retrieve permissions for a specific row in a table',
    auth: [AuthType.ADMIN, AuthType.KEY],
  })
  @CurrentSchemaType(SchemaType.Managed)
  getRowPermissions(
    @CurrentSchema() pg: DataSource,
    @Param() { schemaId: schema = 'public', tableId, rowId }: RowParamsDTO,
    @Project() project: ProjectsDoc,
  ): Promise<string[]> {
    return this.schemasService.getPermissions({
      pg,
      tableId,
      schema,
      rowId,
      project,
    })
  }
}
