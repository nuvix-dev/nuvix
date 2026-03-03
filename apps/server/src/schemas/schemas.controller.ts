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
import { Delete, Get, Patch, Post, Put } from '@nuvix/core'
import { AuthType, CurrentSchemaType, Namespace } from '@nuvix/core/decorators'
import { ParseDuplicatePipe } from '@nuvix/core/pipes'
import { ApiInterceptor, SchemaGuard } from '@nuvix/core/resolvers'
import { SchemaType } from '@nuvix/utils'
import { PermissionsDTO } from './DTO/permissions.dto'
import {
  FunctionParamsDTO,
  RowParamsDTO,
  SelectQueryDTO,
  TableParamsDTO,
} from './DTO/table.dto'
import { SchemasService } from './schemas.service'
import { RestContext, TQuery } from './schemas.types'
import { OrderParser, Parser, SelectParser } from '@nuvix/utils/query'

// Note: The `schemaId` parameter is used in hooks and must be included in all relevant routes.
@Controller({ version: ['1'], path: ['schemas/:schemaId', 'public'] })
@UseGuards(SchemaGuard)
@Namespace('schemas')
@UseInterceptors(ApiInterceptor)
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
    @Query() query: SelectQueryDTO,
  ) {
    return this.schemasService.select({
      table,
      schema,
      query: this.parseQuery({ ...query, table }),
      context: this.buildContext(request),
    })
  }

  @Post(['tables/:tableId'], {
    summary: 'Insert data into table',
    description: 'Insert one or more records into a specific table',
    scopes: 'schemas.tables.write',
  })
  async insertIntoTable(
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
      schema,
      table,
      input,
      columns,
      url: request.raw.url || request.url,

      context: this.requestToContext(request),
    })
  }

  @Patch(['tables/:tableId'], {
    summary: 'Update table data',
    description:
      'Update existing records in a specific table with optional pagination and force flag',
    scopes: 'schemas.tables.write',
  })
  async updateTables(
    @Param() { schemaId: schema = 'public', tableId: table }: TableParamsDTO,

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
    force = false,
  ) {
    return this.schemasService.update({
      schema,
      table,
      input,
      columns,
      url: request.raw.url || request.url,
      limit,
      offset,
      force,

      context: this.requestToContext(request),
    })
  }

  @Delete(['tables/:tableId'], {
    summary: 'Delete table data',
    scopes: 'schemas.tables.write',
    description:
      'Delete records from a specific table with optional pagination and force flag',
    sdk: {
      name: 'delete',
      code: 200,
    },
  })
  async deleteTables(
    @Param() { schemaId: schema = 'public', tableId: table }: TableParamsDTO,

    @Req() request: NuvixRequest,

    @Query('limit', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    offset?: number,
    @Query('force', ParseDuplicatePipe, new ParseBoolPipe({ optional: true }))
    force = false,
  ) {
    return this.schemasService.delete({
      schema,
      table,
      url: request.raw.url || request.url,
      limit,
      offset,
      force,

      context: this.requestToContext(request),
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
      schema,
      functionName,
      url: request.raw.url || request.url,
      limit,
      offset,
      args,

      context: this.requestToContext(request),
    })
  }

  @Put(['tables/:tableId/permissions'], {
    summary: 'Update table permissions',
    description: 'Manage permissions for a specific table',
    auth: [AuthType.ADMIN, AuthType.KEY],
  })
  @CurrentSchemaType(SchemaType.Managed)
  async manageTablePermissions(
    @Param() { schemaId: schema = 'public', tableId }: TableParamsDTO,
    @Body() body: PermissionsDTO,
  ): Promise<string[]> {
    return await this.schemasService.updatePermissions({
      permissions: body.permissions,
      tableId,
      schema,
    })
  }

  @Put(['tables/:tableId/:rowId/permissions'], {
    summary: 'Update row permissions',
    description: 'Manage permissions for a specific row in a table',
    auth: [AuthType.ADMIN, AuthType.KEY],
  })
  @CurrentSchemaType(SchemaType.Managed)
  async manageRowPermissions(
    @Param() { schemaId: schema = 'public', tableId, rowId }: RowParamsDTO,
    @Body() body: PermissionsDTO,
  ): Promise<string[]> {
    return await this.schemasService.updatePermissions({
      permissions: body.permissions,
      tableId,
      schema,
      rowId,
    })
  }

  @Get(['tables/:tableId/permissions'], {
    summary: 'Get table permissions',
    description: 'Retrieve permissions for a specific table',
    auth: [AuthType.ADMIN, AuthType.KEY],
  })
  @CurrentSchemaType(SchemaType.Managed)
  getTablePermissions(
    @Param() { schemaId: schema = 'public', tableId }: TableParamsDTO,
  ): Promise<string[]> {
    return this.schemasService.getPermissions({
      tableId,
      schema,
    })
  }

  @Get(['tables/:tableId/:rowId/permissions'], {
    summary: 'Get row permissions',
    description: 'Retrieve permissions for a specific row in a table',
    auth: [AuthType.ADMIN, AuthType.KEY],
  })
  @CurrentSchemaType(SchemaType.Managed)
  getRowPermissions(
    @Param() { schemaId: schema = 'public', tableId, rowId }: RowParamsDTO,
  ): Promise<string[]> {
    return this.schemasService.getPermissions({
      tableId,
      schema,
      rowId,
    })
  }

  private buildContext(request: NuvixRequest): RestContext {
    return {
      ip: request.ip,
      headers: request.headers,
      method: request.method,
      url: request.url,
      ctx: request.context,
    }
  }

  private parseQuery(query: SelectQueryDTO & { table: string }): TQuery {
    const { filter, select, order, table: tableName, ...rest } = query
    let parsed: TQuery = { ...rest }

    if (filter) {
      parsed.filter = Parser.create({ tableName }).parse(filter)
    }
    if (select) {
      parsed.select = new SelectParser({ tableName }).parse(select)
    }
    if (order) {
      parsed.order = OrderParser.parse(order, tableName)
    }

    return parsed
  }
}
