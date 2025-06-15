import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Param,
  Patch,
  Delete,
  UseFilters,
} from '@nestjs/common';
import { Client } from './decorators';
import { PostgresMeta } from './lib';
import { DeparseDTO, QueryDTO } from './DTO/query.dto';
import * as Parser from './lib/Parser';
import { SchemaQueryDTO } from './DTO/schema.dto';
import { SchemaIdParamDTO } from './DTO/schema-id.dto';
import { SchemaCreateDTO } from './DTO/schema-create.dto';
import { SchemaUpdateDTO } from './DTO/schema-update.dto';
import { SchemaDeleteQueryDTO } from './DTO/schema-delete.dto';
import { TableIdParamDTO } from './DTO/table-id.dto';
import { TableCreateDTO } from './DTO/table-create.dto';
import { TableUpdateDTO } from './DTO/table-update.dto';
import { ColumnCreateDTO } from './DTO/column-create.dto';
import { ColumnUpdateDTO } from './DTO/column-update.dto';
import { ExtensionQueryDTO } from './DTO/extension.dto';
import { ExtensionNameParamDTO } from './DTO/extension-name.dto';
import { ExtensionCreateDTO } from './DTO/extension-create.dto';
import { ExtensionUpdateDTO } from './DTO/extension-update.dto';
import { ExtensionDeleteQueryDTO } from './DTO/extension-delete.dto';
import { RoleQueryDTO } from './DTO/role.dto';
import { RoleIdParamDTO } from './DTO/role-id.dto';
import { RoleCreateDTO } from './DTO/role-create.dto';
import { RoleUpdateDTO } from './DTO/role-update.dto';
import { FunctionQueryDTO } from './DTO/function.dto';
import { FunctionIdParamDTO } from './DTO/function-id.dto';
import { FunctionCreateDTO } from './DTO/function-create.dto';
import { FunctionUpdateDTO } from './DTO/function-update.dto';
import { IndexQueryDTO } from './DTO/index.dto';
import { IndexIdParamDTO } from './DTO/index-id.dto';
import { ViewQueryDTO } from './DTO/view.dto';
import { ViewIdParamDTO } from './DTO/view-id.dto';
import { ForeignTableQueryDTO } from './DTO/foreign-table.dto';
import { ForeignTableIdParamDTO } from './DTO/foreign-table-id.dto';
import { ColumnPrivilegeQueryDTO } from './DTO/column-privilege.dto';
import { ColumnPrivilegeGrantDTO } from './DTO/column-privilege-grant.dto';
import { ColumnPrivilegeRevokeDTO } from './DTO/column-privilege-revoke.dto';
import { MaterializedViewQueryDTO } from './DTO/materialized-view.dto';
import { MaterializedViewIdParamDTO } from './DTO/materialized-view-id.dto';
import { ConfigQueryDTO } from './DTO/config.dto';
import { PolicyQueryDTO } from './DTO/policy.dto';
import { PolicyCreateDTO } from './DTO/policy-create.dto';
import { PolicyUpdateDTO } from './DTO/policy-update.dto';
import { PublicationQueryDTO } from './DTO/publication.dto';
import { PublicationCreateDTO } from './DTO/publication-create.dto';
import { PublicationUpdateDTO } from './DTO/publication-update.dto';
import { TablePrivilegeQueryDTO } from './DTO/table-privilege.dto';
import { TablePrivilegeGrantDTO } from './DTO/table-privilege-grant.dto';
import { TablePrivilegeRevokeDTO } from './DTO/table-privilege-revoke.dto';
import { TriggerQueryDTO } from './DTO/trigger.dto';
import { TriggerCreateDTO } from './DTO/trigger-create.dto';
import { TriggerUpdateDTO } from './DTO/trigger-update.dto';
import { TriggerDeleteQueryDTO } from './DTO/trigger-delete.dto';
import { TypeQueryDTO } from './DTO/type.dto';
import { GeneratorQueryDTO } from './DTO/generator.dto';
import { getGeneratorMetadata } from './lib/generators';
import { apply as applyTypescriptTemplate } from './templates/typescript';
import { apply as applyGoTemplate } from './templates/go';
import { apply as applySwiftTemplate } from './templates/swift';
import { PgMetaExceptionFilter } from './extra/exception.filter';
import { ParseComaStringPipe } from '@nuvix/core/pipes/string-coma.pipe';
import { Exception } from '@nuvix/core/extend/exception';

@Controller({ path: 'database', version: ['1'] })
@UseFilters(PgMetaExceptionFilter)
export class PgMetaController {
  @Post('query')
  async query(@Client() client: PostgresMeta, @Body() body: QueryDTO) {
    const { data } = await client.query(body.query, false);
    return data ?? [];
  }

  @Post('query/format')
  async format(@Body() body: QueryDTO) {
    const { data } = await Parser.Format(body.query);
    return data;
  }

  @Post('query/parse')
  async parse(@Body() body: QueryDTO) {
    const { data } = Parser.Parse(body.query);
    return data;
  }

  @Post('query/deparse')
  async deparse(@Body() body: DeparseDTO) {
    const { data } = Parser.Deparse(body.ast);
    return data;
  }

  /*************************** Schemas *********************************/

  @Get('schemas')
  async getSchemas(
    @Query() query: SchemaQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const {
      include_system_schemas: includeSystemSchemas,
      limit,
      offset,
    } = query;
    const { data } = await client.schemas.list({
      includeSystemSchemas,
      limit,
      offset,
    });
    return data ?? [];
  }

  @Get('schemas/:id')
  async getSchemaById(@Param('id') id: number, @Client() client: PostgresMeta) {
    const { data } = await client.schemas.retrieve({ id });
    return data;
  }

  @Post('schemas')
  async createSchema(
    @Body() body: SchemaCreateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.schemas.create(body);
    return data;
  }

  @Patch('schemas/:id')
  async updateSchema(
    @Param() params: SchemaIdParamDTO,
    @Body() body: SchemaUpdateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.schemas.update(id, body);
    return data;
  }

  @Delete('schemas/:id')
  async deleteSchema(
    @Param() params: SchemaIdParamDTO,
    @Query() query: SchemaDeleteQueryDTO,
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
    @Client() client: PostgresMeta,
    @Query('include_system_schemas') includeSystemSchemas: boolean = false,
    @Query('limit') limit: number = 0,
    @Query('offset') offset: number = 0,
    @Query('include_columns') includeColumns: boolean = false,
    @Query('included_schemas') includedSchemas?: string,
    @Query('excluded_schemas') excludedSchemas?: string,
  ) {
    const { data } = await client.tables.list({
      includeSystemSchemas,
      includedSchemas: includedSchemas?.split(','),
      excludedSchemas: excludedSchemas?.split(','),
      limit,
      offset,
      includeColumns: includeColumns,
    });
    return data ?? [];
  }

  @Get('tables/:id')
  async getTableById(
    @Param() params: TableIdParamDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.tables.retrieve({ id });
    return data;
  }

  @Post('tables')
  async createTable(
    @Body() body: TableCreateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.tables.create(body);
    return data;
  }

  @Patch('tables/:id')
  async updateTable(
    @Param() params: TableIdParamDTO,
    @Body() body: TableUpdateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.tables.update(id, body);
    return data;
  }

  @Delete('tables/:id')
  async deleteTable(
    @Param() params: TableIdParamDTO,
    @Client() client: PostgresMeta,
    @Query('cascade') cascade?: boolean,
  ) {
    const { id } = params;
    const { data } = await client.tables.remove(id, { cascade });
    return data;
  }

  /*************************** Columns *********************************/

  @Get('columns')
  async getColumns(
    @Client() client: PostgresMeta,
    @Query('include_system_schemas') includeSystemSchemas?: boolean,
    @Query('included_schemas', ParseComaStringPipe) includedSchemas?: string[],
    @Query('excluded_schemas', ParseComaStringPipe) excludedSchemas?: string[],
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const { data } = await client.columns.list({
      includeSystemSchemas,
      includedSchemas,
      excludedSchemas,
      limit,
      offset,
    });
    return data ?? [];
  }

  @Get('columns/:tableAndOrdinalPosition')
  async getColumnsByTable(
    @Param('tableAndOrdinalPosition') id: string,
    @Client() client: PostgresMeta,
    @Query('include_system_schemas') includeSystemSchemas?: boolean,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('included_schemas', ParseComaStringPipe) includedSchemas?: string[],
    @Query('excluded_schemas', ParseComaStringPipe) excludedSchemas?: string[],
  ) {
    let tableId: number, ordinalPosition: string;
    if (id.includes('.')) {
      const [tableIdString, ordinalPositionString] = id.split('.');
      tableId = parseInt(tableIdString);
      ordinalPosition = ordinalPositionString;
    } else {
      tableId = parseInt(id);
    }

    if (ordinalPosition) {
      // Get all columns for the table
      const { data } = await client.columns.list({
        tableId,
        includeSystemSchemas,
        limit,
        offset,
        includedSchemas,
        excludedSchemas,
      });
      if (data?.[0]) return data[0];
      throw new Exception(Exception.GENERAL_NOT_FOUND);
    } else if (/^\.\d+$/.test(ordinalPosition)) {
      // Get specific column by tableId.ordinalPosition
      const position = ordinalPosition.slice(1);
      const id = `${tableId}.${position}`;
      const { data } = await client.columns.retrieve({ id });
      return data;
    } else {
      throw new Exception(Exception.GENERAL_NOT_FOUND);
    }
  }

  @Post('columns')
  async createColumn(
    @Body() body: ColumnCreateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.columns.create(body);
    return data;
  }

  @Patch('columns/:id')
  async updateColumn(
    @Param('id') id: string,
    @Body() body: ColumnUpdateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.columns.update(id, body);
    return data;
  }

  @Delete('columns/:id')
  async deleteColumn(
    @Param('id') id: string,
    @Client() client: PostgresMeta,
    @Query('cascade') cascade?: boolean,
  ) {
    const { data } = await client.columns.remove(id, { cascade });
    return data;
  }

  /*************************** Extensions *********************************/

  @Get('extensions')
  async getExtensions(
    @Query() query: ExtensionQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const { limit, offset } = query;
    const { data } = await client.extensions.list({ limit, offset });
    return data ?? [];
  }

  @Get('extensions/:name')
  async getExtensionByName(
    @Param() params: ExtensionNameParamDTO,
    @Client() client: PostgresMeta,
  ) {
    const { name } = params;
    const { data } = await client.extensions.retrieve({ name });
    return data;
  }

  @Post('extensions')
  async createExtension(
    @Body() body: ExtensionCreateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.extensions.create(body);
    return data;
  }

  @Patch('extensions/:name')
  async updateExtension(
    @Param() params: ExtensionNameParamDTO,
    @Body() body: ExtensionUpdateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { name } = params;
    const { data } = await client.extensions.update(name, body);
    return data;
  }

  @Delete('extensions/:name')
  async deleteExtension(
    @Param() params: ExtensionNameParamDTO,
    @Query() query: ExtensionDeleteQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const { name } = params;
    const { cascade } = query;
    const { data } = await client.extensions.remove(name, { cascade });
    return data;
  }

  /*************************** Roles *********************************/

  @Get('roles')
  async getRoles(@Query() query: RoleQueryDTO, @Client() client: PostgresMeta) {
    const { include_default_roles: includeDefaultRoles, limit, offset } = query;
    const { data } = await client.roles.list({
      includeDefaultRoles,
      limit,
      offset,
    });
    return data ?? [];
  }

  @Get('roles/:id')
  async getRoleById(
    @Param() params: RoleIdParamDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.roles.retrieve({ id });
    return data;
  }

  @Post('roles')
  async createRole(
    @Body() body: RoleCreateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.roles.create(body);
    return data;
  }

  @Patch('roles/:id')
  async updateRole(
    @Param() params: RoleIdParamDTO,
    @Body() body: RoleUpdateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.roles.update(id, body);
    return data;
  }

  @Delete('roles/:id')
  async deleteRole(
    @Param() params: RoleIdParamDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.roles.remove(id);
    return data;
  }

  /*************************** Functions *********************************/

  @Get('functions')
  async getFunctions(
    @Query() query: FunctionQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const {
      include_system_schemas: includeSystemSchemas,
      included_schemas: includedSchemas,
      excluded_schemas: excludedSchemas,
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
    @Param() params: FunctionIdParamDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.functions.retrieve({ id });
    return data;
  }

  @Post('functions')
  async createFunction(
    @Body() body: FunctionCreateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.functions.create(body);
    return data;
  }

  @Patch('functions/:id')
  async updateFunction(
    @Param() params: FunctionIdParamDTO,
    @Body() body: FunctionUpdateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.functions.update(id, body);
    return data;
  }

  @Delete('functions/:id')
  async deleteFunction(
    @Param() params: FunctionIdParamDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.functions.remove(id);
    return data;
  }

  /*************************** Indexes *********************************/

  @Get('indexes')
  async getIndexes(
    @Query() query: IndexQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const {
      include_system_schemas: includeSystemSchemas,
      included_schemas: includedSchemas,
      excluded_schemas: excludedSchemas,
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
    @Param() params: IndexIdParamDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.indexes.retrieve({ id });
    return data;
  }

  /*************************** Views *********************************/

  @Get('views')
  async getViews(@Query() query: ViewQueryDTO, @Client() client: PostgresMeta) {
    const {
      include_system_schemas: includeSystemSchemas,
      included_schemas: includedSchemas,
      excluded_schemas: excludedSchemas,
      limit,
      offset,
      include_columns: includeColumns,
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
    @Param() params: ViewIdParamDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.views.retrieve({ id });
    return data;
  }

  /*************************** Foreign Tables *********************************/

  @Get('foreign-tables')
  async getForeignTables(
    @Query() query: ForeignTableQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const { limit, offset, include_columns: includeColumns } = query;
    const { data } = await client.foreignTables.list({
      limit,
      offset,
      includeColumns,
    });
    return data ?? [];
  }

  @Get('foreign-tables/:id')
  async getForeignTableById(
    @Param() params: ForeignTableIdParamDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.foreignTables.retrieve({ id });
    return data;
  }

  /*************************** Column Privileges *********************************/

  @Get('column-privileges')
  async getColumnPrivileges(
    @Query() query: ColumnPrivilegeQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const {
      include_system_schemas: includeSystemSchemas,
      included_schemas: includedSchemas,
      excluded_schemas: excludedSchemas,
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
    @Body() body: ColumnPrivilegeGrantDTO[],
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.columnPrivileges.grant(body);
    return data;
  }

  @Delete('column-privileges')
  async revokeColumnPrivileges(
    @Body() body: ColumnPrivilegeRevokeDTO[],
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.columnPrivileges.revoke(body);
    return data;
  }

  /*************************** Materialized Views *********************************/

  @Get('materialized-views')
  async getMaterializedViews(
    @Query() query: MaterializedViewQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const {
      included_schemas: includedSchemas,
      excluded_schemas: excludedSchemas,
      limit,
      offset,
      include_columns: includeColumns,
    } = query;
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
    @Param() params: MaterializedViewIdParamDTO,
    @Client() client: PostgresMeta,
  ) {
    const { id } = params;
    const { data } = await client.materializedViews.retrieve({ id });
    return data;
  }

  /*************************** Config *********************************/

  @Get('config')
  async getConfig(
    @Query() query: ConfigQueryDTO,
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
    @Query() query: PolicyQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const {
      include_system_schemas: includeSystemSchemas,
      included_schemas: includedSchemas,
      excluded_schemas: excludedSchemas,
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
    @Body() body: PolicyCreateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.policies.create(body);
    return data;
  }

  @Patch('policies/:id')
  async updatePolicy(
    @Param('id') id: number,
    @Body() body: PolicyUpdateDTO,
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
    @Query() query: PublicationQueryDTO,
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
    @Body() body: PublicationCreateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.publications.create(body);
    return data;
  }

  @Patch('publications/:id')
  async updatePublication(
    @Param('id') id: number,
    @Body() body: PublicationUpdateDTO,
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
    @Query() query: TablePrivilegeQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const {
      include_system_schemas: includeSystemSchemas,
      included_schemas: includedSchemas,
      excluded_schemas: excludedSchemas,
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
    @Body() body: TablePrivilegeGrantDTO[],
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.tablePrivileges.grant(body);
    return data;
  }

  @Delete('table-privileges')
  async revokeTablePrivileges(
    @Body() body: TablePrivilegeRevokeDTO[],
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.tablePrivileges.revoke(body);
    return data;
  }

  /*************************** Triggers *********************************/

  @Get('triggers')
  async getTriggers(
    @Query() query: TriggerQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const {
      include_system_schemas: includeSystemSchemas,
      included_schemas: includedSchemas,
      excluded_schemas: excludedSchemas,
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
    @Body() body: TriggerCreateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.triggers.create(body);
    return data;
  }

  @Patch('triggers/:id')
  async updateTrigger(
    @Param('id') id: number,
    @Body() body: TriggerUpdateDTO,
    @Client() client: PostgresMeta,
  ) {
    const { data } = await client.triggers.update(id, body);
    return data;
  }

  @Delete('triggers/:id')
  async deleteTrigger(
    @Param('id') id: number,
    @Query() query: TriggerDeleteQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const { cascade } = query;
    const { data } = await client.triggers.remove(id, { cascade });
    return data;
  }

  /*************************** Types *********************************/

  @Get('types')
  async getTypes(@Query() query: TypeQueryDTO, @Client() client: PostgresMeta) {
    const {
      include_array_types: includeArrayTypes,
      include_system_schemas: includeSystemSchemas,
      included_schemas: includedSchemas,
      excluded_schemas: excludedSchemas,
      limit,
      offset,
    } = query;
    const { data } = await client.types.list({
      includeArrayTypes,
      includeSystemSchemas,
      includedSchemas: includedSchemas?.split(','),
      excludedSchemas: excludedSchemas?.split(','),
      limit,
      offset,
    });
    return data ?? [];
  }

  /*************************** Generators *********************************/

  @Get('generators/typescript')
  async generateTypescript(
    @Query() query: GeneratorQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const {
      included_schemas,
      excluded_schemas,
      detect_one_to_one_relationships: detectOneToOneRelationships,
    } = query;
    const { data } = await getGeneratorMetadata(client, {
      includedSchemas: included_schemas
        ?.split(',')
        .map(schema => schema.trim()),
      excludedSchemas: excluded_schemas
        ?.split(',')
        .map(schema => schema.trim()),
    });

    return applyTypescriptTemplate({
      ...data,
      detectOneToOneRelationships,
    });
  }

  @Get('generators/go')
  async generateGo(
    @Query() query: GeneratorQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const { included_schemas, excluded_schemas } = query;
    const { data } = await getGeneratorMetadata(client, {
      includedSchemas: included_schemas
        ?.split(',')
        .map(schema => schema.trim()),
      excludedSchemas: excluded_schemas
        ?.split(',')
        .map(schema => schema.trim()),
    });
    return applyGoTemplate(data);
  }

  @Get('generators/swift')
  async generateSwift(
    @Query() query: GeneratorQueryDTO,
    @Client() client: PostgresMeta,
  ) {
    const { included_schemas, excluded_schemas, access_control } = query;
    const { data } = await getGeneratorMetadata(client, {
      includedSchemas: included_schemas
        ?.split(',')
        .map(schema => schema.trim()),
      excludedSchemas: excluded_schemas
        ?.split(',')
        .map(schema => schema.trim()),
    });
    return applySwiftTemplate({
      ...data,
      accessControl: access_control ?? 'internal',
    });
  }
}
