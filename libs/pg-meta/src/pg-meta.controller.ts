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
import { ColumnQueryDto } from './DTO/column.dto';
import { ColumnTableParams } from './DTO/column-table.dto';
import { ColumnCreateDto } from './DTO/column-create.dto';
import { ColumnUpdateDto } from './DTO/column-update.dto';
import { ColumnIdParamDto } from './DTO/column-id.dto';
import { ColumnDeleteQueryDto } from './DTO/column-delete.dto';
import { ExtensionQueryDto } from './DTO/extension.dto';
import { ExtensionNameParamDto } from './DTO/extension-name.dto';
import { ExtensionCreateDto } from './DTO/extension-create.dto';
import { ExtensionUpdateDto } from './DTO/extension-update.dto';
import { ExtensionDeleteQueryDto } from './DTO/extension-delete.dto';
import { RoleQueryDto } from './DTO/role.dto';
import { RoleIdParamDto } from './DTO/role-id.dto';
import { RoleCreateDto } from './DTO/role-create.dto';
import { RoleUpdateDto } from './DTO/role-update.dto';
import { FunctionQueryDto } from './DTO/function.dto';
import { FunctionIdParamDto } from './DTO/function-id.dto';
import { FunctionCreateDto } from './DTO/function-create.dto';
import { FunctionUpdateDto } from './DTO/function-update.dto';
import { IndexQueryDto } from './DTO/index.dto';
import { IndexIdParamDto } from './DTO/index-id.dto';
import { ViewQueryDto } from './DTO/view.dto';
import { ViewIdParamDto } from './DTO/view-id.dto';
import { ForeignTableQueryDto } from './DTO/foreign-table.dto';
import { ForeignTableIdParamDto } from './DTO/foreign-table-id.dto';
import { ColumnPrivilegeQueryDto } from './DTO/column-privilege.dto';
import { ColumnPrivilegeGrantDto } from './DTO/column-privilege-grant.dto';
import { ColumnPrivilegeRevokeDto } from './DTO/column-privilege-revoke.dto';
import { MaterializedViewQueryDto } from './DTO/materialized-view.dto';
import { MaterializedViewIdParamDto } from './DTO/materialized-view-id.dto';
import { ConfigQueryDto } from './DTO/config.dto';
import { PolicyQueryDto } from './DTO/policy.dto';
import { PolicyCreateDto } from './DTO/policy-create.dto';
import { PolicyUpdateDto } from './DTO/policy-update.dto';
import { PublicationQueryDto } from './DTO/publication.dto';
import { PublicationCreateDto } from './DTO/publication-create.dto';
import { PublicationUpdateDto } from './DTO/publication-update.dto';
import { TablePrivilegeQueryDto } from './DTO/table-privilege.dto';
import { TablePrivilegeGrantDto } from './DTO/table-privilege-grant.dto';
import { TablePrivilegeRevokeDto } from './DTO/table-privilege-revoke.dto';
import { TriggerQueryDto } from './DTO/trigger.dto';
import { TriggerIdParamDto } from './DTO/trigger-id.dto';
import { TriggerCreateDto } from './DTO/trigger-create.dto';
import { TriggerUpdateDto } from './DTO/trigger-update.dto';
import { TriggerDeleteQueryDto } from './DTO/trigger-delete.dto';

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

  /*************************** Columns *********************************/

  @Get('columns')
  async getColumns(
    @Query() query: ColumnQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const {
      includeSystemSchemas,
      includedSchemas,
      excludedSchemas,
      limit,
      offset,
    } = query;
    const { data } = await client.columns.list({
      includeSystemSchemas,
      includedSchemas: includedSchemas?.split(','),
      excludedSchemas: excludedSchemas?.split(','),
      limit,
      offset,
    });
    return data ?? [];
  }

  @Get('columns/:tableId:ordinalPosition')
  async getColumnsByTable(
    @Param() params: ColumnTableParams,
    @Query() query: ColumnQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const { tableId, ordinalPosition } = params;
    const { includeSystemSchemas, limit, offset } = query;

    if (!ordinalPosition) {
      // Get all columns for the table
      const { data } = await client.columns.list({
        tableId,
        includeSystemSchemas,
        limit,
        offset,
      });
      return data?.[0] ?? null;
    } else if (
      ordinalPosition.startsWith('.') &&
      /^\.\d+$/.test(ordinalPosition)
    ) {
      // Get specific column by tableId.ordinalPosition
      const position = ordinalPosition.slice(1);
      const id = `${tableId}.${position}`;
      const { data } = await client.columns.retrieve({ id });
      return data;
    }
  }

  @Post('columns')
  async createColumn(
    @Body() body: ColumnCreateDto,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.columns.create(body);
    return data;
  }

  @Patch('columns/:id')
  async updateColumn(
    @Param() params: ColumnIdParamDto,
    @Body() body: ColumnUpdateDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.columns.update(id, body);
    return data;
  }

  @Delete('columns/:id')
  async deleteColumn(
    @Param() params: ColumnIdParamDto,
    @Query() query: ColumnDeleteQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { cascade } = query;
    const { data } = await client.columns.remove(id, { cascade });
    return data;
  }

  /*************************** Extensions *********************************/

  @Get('extensions')
  async getExtensions(
    @Query() query: ExtensionQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const { limit, offset } = query;
    const { data } = await client.extensions.list({ limit, offset });
    return data ?? [];
  }

  @Get('extensions/:name')
  async getExtensionByName(
    @Param() params: ExtensionNameParamDto,
    @Client() client: PostgresMeta,
  ) {
    const { name } = params;
    const { data } = await client.extensions.retrieve({ name });
    return data;
  }

  @Post('extensions')
  async createExtension(
    @Body() body: ExtensionCreateDto,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.extensions.create(body);
    return data;
  }

  @Patch('extensions/:name')
  async updateExtension(
    @Param() params: ExtensionNameParamDto,
    @Body() body: ExtensionUpdateDto,
    @Client() client: PostgresMeta,
  ) {
    const { name } = params;
    const { data } = await client.extensions.update(name, body);
    return data;
  }

  @Delete('extensions/:name')
  async deleteExtension(
    @Param() params: ExtensionNameParamDto,
    @Query() query: ExtensionDeleteQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const { name } = params;
    const { cascade } = query;
    const { data } = await client.extensions.remove(name, { cascade });
    return data;
  }

  /*************************** Roles *********************************/

  @Get('roles')
  async getRoles(@Query() query: RoleQueryDto, @Client() client: PostgresMeta) {
    const { includeDefaultRoles, limit, offset } = query;
    const { data } = await client.roles.list({
      includeDefaultRoles,
      limit,
      offset,
    });
    return data ?? [];
  }

  @Get('roles/:id')
  async getRoleById(
    @Param() params: RoleIdParamDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.roles.retrieve({ id });
    return data;
  }

  @Post('roles')
  async createRole(
    @Body() body: RoleCreateDto,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.roles.create(body);
    return data;
  }

  @Patch('roles/:id')
  async updateRole(
    @Param() params: RoleIdParamDto,
    @Body() body: RoleUpdateDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.roles.update(id, body);
    return data;
  }

  @Delete('roles/:id')
  async deleteRole(
    @Param() params: RoleIdParamDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.roles.remove(id);
    return data;
  }

  /*************************** Functions *********************************/

  @Get('functions')
  async getFunctions(
    @Query() query: FunctionQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const {
      includeSystemSchemas,
      includedSchemas,
      excludedSchemas,
      limit,
      offset,
    } = query;
    const { data } = await client.functions.list({
      includeSystemSchemas,
      includedSchemas: includedSchemas?.split(','),
      excludedSchemas: excludedSchemas?.split(','),
      limit,
      offset,
    });
    return data ?? [];
  }

  @Get('functions/:id')
  async getFunctionById(
    @Param() params: FunctionIdParamDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.functions.retrieve({ id });
    return data;
  }

  @Post('functions')
  async createFunction(
    @Body() body: FunctionCreateDto,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.functions.create(body);
    return data;
  }

  @Patch('functions/:id')
  async updateFunction(
    @Param() params: FunctionIdParamDto,
    @Body() body: FunctionUpdateDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.functions.update(id, body);
    return data;
  }

  @Delete('functions/:id')
  async deleteFunction(
    @Param() params: FunctionIdParamDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.functions.remove(id);
    return data;
  }

  /*************************** Indexes *********************************/

  @Get('indexes')
  async getIndexes(
    @Query() query: IndexQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const {
      includeSystemSchemas,
      includedSchemas,
      excludedSchemas,
      limit,
      offset,
    } = query;
    const { data } = await client.indexes.list({
      includeSystemSchemas,
      includedSchemas: includedSchemas?.split(','),
      excludedSchemas: excludedSchemas?.split(','),
      limit,
      offset,
    });
    return data ?? [];
  }

  @Get('indexes/:id')
  async getIndexById(
    @Param() params: IndexIdParamDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.indexes.retrieve({ id });
    return data;
  }

  /*************************** Views *********************************/

  @Get('views')
  async getViews(@Query() query: ViewQueryDto, @Client() client: PostgresMeta) {
    const {
      includeSystemSchemas,
      includedSchemas,
      excludedSchemas,
      limit,
      offset,
      includeColumns,
    } = query;
    const { data } = await client.views.list({
      includeSystemSchemas,
      includedSchemas: includedSchemas?.split(','),
      excludedSchemas: excludedSchemas?.split(','),
      limit,
      offset,
      includeColumns,
    });
    return data ?? [];
  }

  @Get('views/:id')
  async getViewById(
    @Param() params: ViewIdParamDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.views.retrieve({ id });
    return data;
  }

  /*************************** Foreign Tables *********************************/

  @Get('foreign-tables')
  async getForeignTables(
    @Query() query: ForeignTableQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const { limit, offset, includeColumns } = query;
    const { data } = await client.foreignTables.list({
      limit,
      offset,
      includeColumns,
    });
    return data ?? [];
  }

  @Get('foreign-tables/:id')
  async getForeignTableById(
    @Param() params: ForeignTableIdParamDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.foreignTables.retrieve({ id });
    return data;
  }

  /*************************** Column Privileges *********************************/

  @Get('column-privileges')
  async getColumnPrivileges(
    @Query() query: ColumnPrivilegeQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const {
      includeSystemSchemas,
      includedSchemas,
      excludedSchemas,
      limit,
      offset,
    } = query;
    const { data } = await client.columnPrivileges.list({
      includeSystemSchemas,
      includedSchemas: includedSchemas?.split(','),
      excludedSchemas: excludedSchemas?.split(','),
      limit,
      offset,
    });
    return data ?? [];
  }

  @Post('column-privileges')
  async grantColumnPrivileges(
    @Body() body: ColumnPrivilegeGrantDto[],
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.columnPrivileges.grant(body);
    return data;
  }

  @Delete('column-privileges')
  async revokeColumnPrivileges(
    @Body() body: ColumnPrivilegeRevokeDto[],
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.columnPrivileges.revoke(body);
    return data;
  }

  /*************************** Materialized Views *********************************/

  @Get('materialized-views')
  async getMaterializedViews(
    @Query() query: MaterializedViewQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const { includedSchemas, excludedSchemas, limit, offset, includeColumns } =
      query;
    const { data } = await client.materializedViews.list({
      includedSchemas: includedSchemas?.split(','),
      excludedSchemas: excludedSchemas?.split(','),
      limit,
      offset,
      includeColumns,
    });
    return data ?? [];
  }

  @Get('materialized-views/:id')
  async getMaterializedViewById(
    @Param() params: MaterializedViewIdParamDto,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.materializedViews.retrieve({ id });
    return data;
  }

  /*************************** Config *********************************/

  @Get('config')
  async getConfig(
    @Query() query: ConfigQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const { limit, offset } = query;
    const { data } = await client.config.list({ limit, offset });
    return data ?? [];
  }

  @Get('config/version')
  async getVersion(@Client() client: PostgresMeta) {
    const { data } = await client.version.retrieve();
    return data;
  }

  /*************************** Policies *********************************/

  @Get('policies')
  async getPolicies(
    @Query() query: PolicyQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const {
      includeSystemSchemas,
      includedSchemas,
      excludedSchemas,
      limit,
      offset,
    } = query;
    const { data } = await client.policies.list({
      includeSystemSchemas,
      includedSchemas: includedSchemas?.split(','),
      excludedSchemas: excludedSchemas?.split(','),
      limit,
      offset,
    });
    return data ?? [];
  }

  @Get('policies/:id')
  async getPolicyById(@Param('id') id: number, @Client() client: PostgresMeta) {
    const { data } = await client.policies.retrieve({ id });
    return data;
  }

  @Post('policies')
  async createPolicy(
    @Body() body: PolicyCreateDto,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.policies.create(body);
    return data;
  }

  @Patch('policies/:id')
  async updatePolicy(
    @Param('id') id: number,
    @Body() body: PolicyUpdateDto,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.policies.update(id, body);
    return data;
  }

  @Delete('policies/:id')
  async deletePolicy(@Param('id') id: number, @Client() client: PostgresMeta) {
    const { data } = await client.policies.remove(id);
    return data;
  }

  /*************************** Publications *********************************/

  @Get('publications')
  async getPublications(
    @Query() query: PublicationQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const { limit, offset } = query;
    const { data } = await client.publications.list({ limit, offset });
    return data ?? [];
  }

  @Get('publications/:id')
  async getPublicationById(
    @Param('id') id: number,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.publications.retrieve({ id });
    return data;
  }

  @Post('publications')
  async createPublication(
    @Body() body: PublicationCreateDto,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.publications.create(body);
    return data;
  }

  @Patch('publications/:id')
  async updatePublication(
    @Param('id') id: number,
    @Body() body: PublicationUpdateDto,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.publications.update(id, body);
    return data;
  }

  @Delete('publications/:id')
  async deletePublication(
    @Param('id') id: number,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.publications.remove(id);
    return data;
  }

  /*************************** Table Privileges *********************************/

  @Get('table-privileges')
  async getTablePrivileges(
    @Query() query: TablePrivilegeQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const {
      includeSystemSchemas,
      includedSchemas,
      excludedSchemas,
      limit,
      offset,
    } = query;
    const { data } = await client.tablePrivileges.list({
      includeSystemSchemas,
      includedSchemas: includedSchemas?.split(','),
      excludedSchemas: excludedSchemas?.split(','),
      limit,
      offset,
    });
    return data ?? [];
  }

  @Post('table-privileges')
  async grantTablePrivileges(
    @Body() body: TablePrivilegeGrantDto[],
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.tablePrivileges.grant(body);
    return data;
  }

  @Delete('table-privileges')
  async revokeTablePrivileges(
    @Body() body: TablePrivilegeRevokeDto[],
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.tablePrivileges.revoke(body);
    return data;
  }

  /*************************** Triggers *********************************/

  @Get('triggers')
  async getTriggers(
    @Query() query: TriggerQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const {
      includeSystemSchemas,
      includedSchemas,
      excludedSchemas,
      limit,
      offset,
    } = query;
    const { data } = await client.triggers.list({
      includeSystemSchemas,
      includedSchemas: includedSchemas?.split(','),
      excludedSchemas: excludedSchemas?.split(','),
      limit,
      offset,
    });
    return data ?? [];
  }

  @Get('triggers/:id')
  async getTriggerById(
    @Param('id') id: number,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.triggers.retrieve({ id });
    return data;
  }

  @Post('triggers')
  async createTrigger(
    @Body() body: TriggerCreateDto,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.triggers.create(body);
    return data;
  }

  @Patch('triggers/:id')
  async updateTrigger(
    @Param('id') id: number,
    @Body() body: TriggerUpdateDto,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.triggers.update(id, body);
    return data;
  }

  @Delete('triggers/:id')
  async deleteTrigger(
    @Param('id') id: number,
    @Query() query: TriggerDeleteQueryDto,
    @Client() client: PostgresMeta,
  ) {
    const { cascade } = query;
    const { data } = await client.triggers.remove(id, { cascade });
    return data;
  }
}
