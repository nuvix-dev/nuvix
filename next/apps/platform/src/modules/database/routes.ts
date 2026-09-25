import { Elysia, t } from 'elysia'
import type { DatabaseService } from './service'

export function databaseRoutes(service: DatabaseService) {
  return new Elysia({ name: 'database-routes' })
    .post(
      '/projects/:projectId/database/query',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          query: t.String({ minLength: 1 }),
        }),
        detail: { summary: 'Execute raw SQL query on tenant database', tags: ['database'] },
      },
      ({ params, body }) => service.query(params.projectId, body.query),
    )
    .get(
      '/projects/:projectId/database/schemas',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          includeSystemSchemas: t.Optional(t.BooleanString()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: 'List database schemas', tags: ['database'] },
      },
      ({ params, query }) =>
        service.listSchemas(params.projectId, {
          includeSystemSchemas: query.includeSystemSchemas,
          limit: query.limit,
          offset: query.offset,
        }),
    )
    .get(
      '/projects/:projectId/database/schemas/:nameOrId',
      {
        params: t.Object({
          projectId: t.String(),
          nameOrId: t.String(),
        }),
        detail: { summary: 'Get database schema by name or ID', tags: ['database'] },
      },
      ({ params }) => service.getSchema(params.projectId, params.nameOrId),
    )
    .get(
      '/projects/:projectId/database/tables',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          includeSystemSchemas: t.Optional(t.BooleanString()),
          includeColumns: t.Optional(t.BooleanString()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: 'List database tables', tags: ['database'] },
      },
      ({ params, query }) =>
        service.listTables(params.projectId, {
          includeSystemSchemas: query.includeSystemSchemas,
          includeColumns: query.includeColumns,
          limit: query.limit,
          offset: query.offset,
        }),
    )
    .get(
      '/projects/:projectId/database/tables/:id',
      {
        params: t.Object({
          projectId: t.String(),
          id: t.Numeric(),
        }),
        query: t.Object({
          includeColumns: t.Optional(t.BooleanString()),
        }),
        detail: { summary: 'Get database table by ID', tags: ['database'] },
      },
      ({ params, query }) =>
        service.getTable(params.projectId, params.id, {
          includeColumns: query.includeColumns,
        }),
    )
    .get(
      '/projects/:projectId/database/columns',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          tableId: t.Optional(t.Numeric()),
          table: t.Optional(t.String()),
          schema: t.Optional(t.String()),
          includeSystemSchemas: t.Optional(t.BooleanString()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: 'List database columns', tags: ['database'] },
      },
      ({ params, query }) =>
        service.listColumns(params.projectId, {
          tableId: query.tableId,
          table: query.table,
          schema: query.schema,
          includeSystemSchemas: query.includeSystemSchemas,
          limit: query.limit,
          offset: query.offset,
        }),
    )
    .get(
      '/projects/:projectId/database/indexes',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          tableId: t.Optional(t.Numeric()),
          includeSystemSchemas: t.Optional(t.BooleanString()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: 'List database indexes', tags: ['database'] },
      },
      ({ params, query }) =>
        service.listIndexes(params.projectId, {
          tableId: query.tableId,
          includeSystemSchemas: query.includeSystemSchemas,
          limit: query.limit,
          offset: query.offset,
        }),
    )
    .get(
      '/projects/:projectId/database/functions',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          includeSystemSchemas: t.Optional(t.BooleanString()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: 'List database functions', tags: ['database'] },
      },
      ({ params, query }) =>
        service.listFunctions(params.projectId, {
          includeSystemSchemas: query.includeSystemSchemas,
          limit: query.limit,
          offset: query.offset,
        }),
    )
    .get(
      '/projects/:projectId/database/roles',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: 'List database roles', tags: ['database'] },
      },
      ({ params, query }) =>
        service.listRoles(params.projectId, {
          limit: query.limit,
          offset: query.offset,
        }),
    )
    .get(
      '/projects/:projectId/database/extensions',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: 'List database extensions', tags: ['database'] },
      },
      ({ params, query }) =>
        service.listExtensions(params.projectId, {
          limit: query.limit,
          offset: query.offset,
        }),
    )
    .get(
      '/projects/:projectId/database/views',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          includeSystemSchemas: t.Optional(t.BooleanString()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: 'List database views', tags: ['database'] },
      },
      ({ params, query }) =>
        service.listViews(params.projectId, {
          includeSystemSchemas: query.includeSystemSchemas,
          limit: query.limit,
          offset: query.offset,
        }),
    )
    .get(
      '/projects/:projectId/database/triggers',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          tableId: t.Optional(t.Numeric()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: 'List database triggers', tags: ['database'] },
      },
      ({ params, query }) =>
        service.listTriggers(params.projectId, {
          tableId: query.tableId,
          limit: query.limit,
          offset: query.offset,
        }),
    )
    .get(
      '/projects/:projectId/database/types',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          includeSystemSchemas: t.Optional(t.BooleanString()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: 'List database custom types', tags: ['database'] },
      },
      ({ params, query }) =>
        service.listTypes(params.projectId, {
          includeSystemSchemas: query.includeSystemSchemas,
          limit: query.limit,
          offset: query.offset,
        }),
    )
    .get(
      '/projects/:projectId/database/policies',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          tableId: t.Optional(t.Numeric()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: 'List database policies', tags: ['database'] },
      },
      ({ params, query }) =>
        service.listPolicies(params.projectId, {
          tableId: query.tableId,
          limit: query.limit,
          offset: query.offset,
        }),
    )
    .get(
      '/projects/:projectId/database/version',
      {
        params: t.Object({ projectId: t.String() }),
        detail: { summary: 'Get PostgreSQL server version', tags: ['database'] },
      },
      ({ params }) => service.getVersion(params.projectId),
    )
    .get(
      '/projects/:projectId/database/config',
      {
        params: t.Object({ projectId: t.String() }),
        detail: { summary: 'Get PostgreSQL server configuration settings', tags: ['database'] },
      },
      ({ params }) => service.getConfig(params.projectId),
    )
}
