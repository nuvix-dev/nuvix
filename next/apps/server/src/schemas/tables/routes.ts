import { Elysia, t } from 'elysia'
import type { TenantContext } from '../../context/tenant'
import { ForbiddenError } from '../../shared/errors'
import { type RequestContext, TablesService } from './service'

export interface TablesRouteServices {
  tables?: TablesService
}

export function extractRequestContext(tenant: TenantContext, req: Request): RequestContext {
  return {
    method: req.method,
    url: req.url,
    id: req.headers.get('x-request-id') ?? undefined,
    headers: Object.fromEntries(req.headers.entries()),
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    user: tenant.user,
    session: tenant.session,
    roles: tenant.roles,
    allowedSchemas: ((tenant.project as any)?.metadata as any)?.allowedSchemas ?? [],
  }
}

export const schemaTablesRoutes = (services?: TablesRouteServices) =>
  new Elysia()
    .derive('plugin', (ctx) => {
      const tenant = ctx as unknown as TenantContext
      const tablesService = services?.tables ?? new TablesService(() => tenant.tenantResource)
      return { tenant, tablesService }
    })

    // 1. Select rows
    .get(
      '/tables/:tableId',
      {
        detail: {
          summary: 'Query table rows',
          description:
            'Select and filter rows from a database table using PostgREST-compatible syntax with pagination and ordering.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Database schema name' }),
          tableId: t.String({ description: 'Table name or identifier' }),
        }),
        query: t.Optional(
          t.Object({
            select: t.Optional(
              t.String({ description: 'Columns to select (comma-separated or wildcard)' }),
            ),
            filter: t.Optional(
              t.String({ description: 'Filter expression (e.g. status.eq.active)' }),
            ),
            order: t.Optional(t.String({ description: 'Ordering expression (e.g. id.desc)' })),
            limit: t.Optional(t.String({ description: 'Maximum rows to return' })),
            offset: t.Optional(t.String({ description: 'Number of rows to skip' })),
          }),
        ),
      },
      async ({ tenant, tablesService, params: { schemaId, tableId }, query, request }) => {
        return tablesService.select({
          schema: schemaId,
          table: tableId,
          select: query?.select,
          filter: query?.filter,
          order: query?.order,
          limit: query?.limit ? Number(query.limit) : undefined,
          offset: query?.offset ? Number(query.offset) : undefined,
          context: extractRequestContext(tenant, request),
        })
      },
    )

    // 2. Count rows
    .get(
      '/tables/:tableId/count',
      {
        detail: {
          summary: 'Count table rows',
          description: 'Return total row count matching optional filter expression.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Database schema name' }),
          tableId: t.String({ description: 'Table name or identifier' }),
        }),
        query: t.Optional(
          t.Object({
            filter: t.Optional(t.String({ description: 'Filter expression' })),
          }),
        ),
      },
      async ({ tenant, tablesService, params: { schemaId, tableId }, query, request }) => {
        return tablesService.count({
          schema: schemaId,
          table: tableId,
          filter: query?.filter,
          context: extractRequestContext(tenant, request),
        })
      },
    )

    // 3. Get single row by ID
    .get(
      '/tables/:tableId/:rowId',
      {
        detail: {
          summary: 'Get table row by ID',
          description: 'Fetch a single row by primary key.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Database schema name' }),
          tableId: t.String({ description: 'Table name or identifier' }),
          rowId: t.String({ description: 'Row primary key value' }),
        }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String({ description: 'Columns to select' })),
            filter: t.Optional(t.String({ description: 'Additional filter condition' })),
          }),
        ),
      },
      async ({ tenant, tablesService, params: { schemaId, tableId, rowId }, query, request }) => {
        return tablesService.getRow({
          schema: schemaId,
          table: tableId,
          rowId,
          select: query?.select,
          filter: query?.filter,
          context: extractRequestContext(tenant, request),
        })
      },
    )

    // 4. Insert row(s)
    .post(
      '/tables/:tableId',
      {
        detail: {
          summary: 'Insert table row(s)',
          description:
            'Insert one or multiple rows into a table with optional conflict resolution.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Database schema name' }),
          tableId: t.String({ description: 'Table name or identifier' }),
        }),
        query: t.Optional(
          t.Object({
            columns: t.Optional(t.String({ description: 'Column list to insert' })),
            on_conflict: t.Optional(t.String({ description: 'Conflict resolution columns' })),
            ignore_duplicates: t.Optional(
              t.Boolean({ description: 'Ignore duplicate key errors' }),
            ),
            select: t.Optional(t.String({ description: 'Returned columns selection' })),
          }),
        ),
        body: t.Union([t.Record(t.String(), t.Any()), t.Array(t.Record(t.String(), t.Any()))], {
          description: 'Single row object or array of row objects to insert',
        }),
      },
      async ({ tenant, tablesService, params: { schemaId, tableId }, query, body, request }) => {
        return tablesService.insert({
          schema: schemaId,
          table: tableId,
          input: body,
          columns: query?.columns ? query.columns.split(',').map((c) => c.trim()) : undefined,
          onConflict: query?.on_conflict,
          ignoreDuplicates: query?.ignore_duplicates,
          select: query?.select,
          context: extractRequestContext(tenant, request),
        })
      },
    )

    // 5. Upsert row(s)
    .put(
      '/tables/:tableId',
      {
        detail: {
          summary: 'Upsert table row(s)',
          description: 'Insert or update rows based on conflict target columns.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Database schema name' }),
          tableId: t.String({ description: 'Table name or identifier' }),
        }),
        query: t.Object({
          columns: t.Optional(t.String({ description: 'Column list' })),
          on_conflict: t.String({ description: 'Unique conflict column(s) to match on' }),
          select: t.Optional(t.String({ description: 'Returned columns selection' })),
        }),
        body: t.Union([t.Record(t.String(), t.Any()), t.Array(t.Record(t.String(), t.Any()))], {
          description: 'Row object or array of row objects to upsert',
        }),
      },
      async ({ tenant, tablesService, params: { schemaId, tableId }, query, body, request }) => {
        return tablesService.upsert({
          schema: schemaId,
          table: tableId,
          input: body,
          columns: query?.columns ? query.columns.split(',').map((c) => c.trim()) : undefined,
          onConflict: query.on_conflict,
          select: query?.select,
          context: extractRequestContext(tenant, request),
        })
      },
    )

    // 6. Bulk update rows
    .patch(
      '/tables/:tableId',
      {
        detail: {
          summary: 'Update table rows',
          description: 'Update rows in the table matching filter criteria.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Database schema name' }),
          tableId: t.String({ description: 'Table name or identifier' }),
        }),
        query: t.Optional(
          t.Object({
            columns: t.Optional(t.String({ description: 'Columns to update' })),
            select: t.Optional(t.String({ description: 'Columns to return' })),
            filter: t.Optional(t.String({ description: 'Filter expression' })),
            order: t.Optional(t.String({ description: 'Order expression' })),
            limit: t.Optional(t.String({ description: 'Row update limit' })),
            offset: t.Optional(t.String({ description: 'Row update offset' })),
            force: t.Optional(
              t.Union([t.String(), t.Boolean()], { description: 'Force full table update' }),
            ),
          }),
        ),
        body: t.Record(t.String(), t.Any(), { description: 'Column key-value pairs to set' }),
      },
      async ({ tenant, tablesService, params: { schemaId, tableId }, query, body, request }) => {
        return tablesService.update({
          schema: schemaId,
          table: tableId,
          input: body,
          columns: query?.columns ? query.columns.split(',').map((c) => c.trim()) : undefined,
          select: query?.select,
          filter: query?.filter,
          order: query?.order,
          limit: query?.limit ? Number(query.limit) : undefined,
          offset: query?.offset ? Number(query.offset) : undefined,
          force: query?.force ? String(query.force).toLowerCase() === 'true' : false,
          context: extractRequestContext(tenant, request),
        })
      },
    )

    // 7. Update row by ID
    .patch(
      '/tables/:tableId/:rowId',
      {
        detail: {
          summary: 'Update row by ID',
          description: 'Partially update an individual table row by primary key.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Database schema name' }),
          tableId: t.String({ description: 'Table name or identifier' }),
          rowId: t.String({ description: 'Row primary key value' }),
        }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String({ description: 'Columns to return' })),
            filter: t.Optional(t.String({ description: 'Additional filter condition' })),
          }),
        ),
        body: t.Record(t.String(), t.Any(), { description: 'Updated column values' }),
      },
      async ({
        tenant,
        tablesService,
        params: { schemaId, tableId, rowId },
        query,
        body,
        request,
      }) => {
        return tablesService.updateRow({
          schema: schemaId,
          table: tableId,
          rowId,
          input: body,
          filter: query?.filter,
          select: query?.select,
          context: extractRequestContext(tenant, request),
        })
      },
    )

    // 8. Bulk delete rows
    .delete(
      '/tables/:tableId',
      {
        detail: {
          summary: 'Delete table rows',
          description: 'Delete rows from a table matching filter criteria.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Database schema name' }),
          tableId: t.String({ description: 'Table name or identifier' }),
        }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String({ description: 'Columns to return from deleted rows' })),
            filter: t.Optional(t.String({ description: 'Filter expression' })),
            order: t.Optional(t.String({ description: 'Order expression' })),
            limit: t.Optional(t.String({ description: 'Delete limit' })),
            offset: t.Optional(t.String({ description: 'Delete offset' })),
            force: t.Optional(
              t.Union([t.String(), t.Boolean()], { description: 'Force full table deletion' }),
            ),
          }),
        ),
      },
      async ({ tenant, tablesService, params: { schemaId, tableId }, query, request }) => {
        return tablesService.delete({
          schema: schemaId,
          table: tableId,
          select: query?.select,
          filter: query?.filter,
          order: query?.order,
          limit: query?.limit ? Number(query.limit) : undefined,
          offset: query?.offset ? Number(query.offset) : undefined,
          force: query?.force ? String(query.force).toLowerCase() === 'true' : false,
          context: extractRequestContext(tenant, request),
        })
      },
    )

    // 9. Delete row by ID
    .delete(
      '/tables/:tableId/:rowId',
      {
        detail: {
          summary: 'Delete row by ID',
          description: 'Delete a single row by primary key.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Database schema name' }),
          tableId: t.String({ description: 'Table name or identifier' }),
          rowId: t.String({ description: 'Row primary key value' }),
        }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String({ description: 'Columns to return' })),
            filter: t.Optional(t.String({ description: 'Filter expression' })),
          }),
        ),
      },
      async ({ tenant, tablesService, params: { schemaId, tableId, rowId }, query, request }) => {
        return tablesService.deleteRow({
          schema: schemaId,
          table: tableId,
          rowId,
          filter: query?.filter,
          select: query?.select,
          context: extractRequestContext(tenant, request),
        })
      },
    )

    // 10. Table permissions
    .get(
      '/tables/:tableId/permissions',
      {
        detail: {
          summary: 'Get table permissions',
          description: 'Retrieve RLS permissions configured on a table.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Schema name' }),
          tableId: t.String({ description: 'Table name' }),
        }),
      },
      async ({ tenant, tablesService, params: { schemaId, tableId } }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        return tablesService.getPermissions({
          schema: schemaId,
          tableId,
        })
      },
    )
    .put(
      '/tables/:tableId/permissions',
      {
        detail: {
          summary: 'Update table permissions',
          description: 'Update RLS permissions for an entire table.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Schema name' }),
          tableId: t.String({ description: 'Table name' }),
        }),
        body: t.Object({
          permissions: t.Array(t.String(), { description: 'Updated permission rules list' }),
        }),
      },
      async ({ tenant, tablesService, params: { schemaId, tableId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        return tablesService.updatePermissions({
          schema: schemaId,
          tableId,
          permissions: body.permissions,
        })
      },
    )

    // 11. Row permissions
    .get(
      '/tables/:tableId/:rowId/permissions',
      {
        detail: {
          summary: 'Get row permissions',
          description: 'Retrieve row-level permissions for a specific row.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Schema name' }),
          tableId: t.String({ description: 'Table name' }),
          rowId: t.String({ description: 'Row ID' }),
        }),
      },
      async ({ tenant, tablesService, params: { schemaId, tableId, rowId } }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        return tablesService.getPermissions({
          schema: schemaId,
          tableId,
          rowId,
        })
      },
    )
    .put(
      '/tables/:tableId/:rowId/permissions',
      {
        detail: {
          summary: 'Update row permissions',
          description: 'Update row-level permissions for an individual row.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Schema name' }),
          tableId: t.String({ description: 'Table name' }),
          rowId: t.String({ description: 'Row ID' }),
        }),
        body: t.Object({
          permissions: t.Array(t.String(), { description: 'Updated row permissions' }),
        }),
      },
      async ({ tenant, tablesService, params: { schemaId, tableId, rowId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        return tablesService.updatePermissions({
          schema: schemaId,
          tableId,
          rowId,
          permissions: body.permissions,
        })
      },
    )

    // 12. RPC Functions
    .post(
      '/rpc/:functionId',
      {
        detail: {
          summary: 'Execute stored function (RPC)',
          description: 'Invoke a PostgreSQL stored procedure or function within the schema.',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Schema name' }),
          functionId: t.String({ description: 'Function or procedure name' }),
        }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String({ description: 'Columns to select' })),
            filter: t.Optional(t.String({ description: 'Filter expression' })),
            order: t.Optional(t.String({ description: 'Order expression' })),
            limit: t.Optional(t.String({ description: 'Row limit' })),
            offset: t.Optional(t.String({ description: 'Row offset' })),
          }),
        ),
        body: t.Optional(
          t.Union([t.Record(t.String(), t.Any()), t.Array(t.Any())], {
            description: 'Arguments passed to function (object or array)',
          }),
        ),
      },
      async ({ tenant, tablesService, params: { schemaId, functionId }, query, body, request }) => {
        return tablesService.callFunction({
          schema: schemaId,
          functionName: functionId,
          args: (body ?? undefined) as Record<string, unknown> | unknown[] | undefined,
          select: query?.select,
          filter: query?.filter,
          order: query?.order,
          limit: query?.limit ? Number(query.limit) : undefined,
          offset: query?.offset ? Number(query.offset) : undefined,
          context: extractRequestContext(tenant, request),
        })
      },
    )
    .post(
      '/fn/:functionId',
      {
        detail: {
          summary: 'Execute stored function alias (/fn)',
          description: 'Invoke a PostgreSQL stored procedure (alias of /rpc).',
          tags: ['Schemas Tables'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Schema name' }),
          functionId: t.String({ description: 'Function or procedure name' }),
        }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String({ description: 'Columns to select' })),
            filter: t.Optional(t.String({ description: 'Filter expression' })),
            order: t.Optional(t.String({ description: 'Order expression' })),
            limit: t.Optional(t.String({ description: 'Row limit' })),
            offset: t.Optional(t.String({ description: 'Row offset' })),
          }),
        ),
        body: t.Optional(
          t.Union([t.Record(t.String(), t.Any()), t.Array(t.Any())], {
            description: 'Function arguments',
          }),
        ),
      },
      async ({ tenant, tablesService, params: { schemaId, functionId }, query, body, request }) => {
        return tablesService.callFunction({
          schema: schemaId,
          functionName: functionId,
          args: (body ?? undefined) as Record<string, unknown> | unknown[] | undefined,
          select: query?.select,
          filter: query?.filter,
          order: query?.order,
          limit: query?.limit ? Number(query.limit) : undefined,
          offset: query?.offset ? Number(query.offset) : undefined,
          context: extractRequestContext(tenant, request),
        })
      },
    )

export const publicTablesRoutes = (services?: TablesRouteServices) =>
  new Elysia({ prefix: '/public' })
    .derive('plugin', (ctx) => {
      const tenant = ctx as unknown as TenantContext
      const tablesService = services?.tables ?? new TablesService(() => tenant.tenantResource)
      return { tenant, tablesService }
    })
    .get(
      '/tables/:tableId',
      {
        detail: {
          summary: 'Query public table rows',
          description: 'Query rows from a table in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({ tableId: t.String({ description: 'Table name' }) }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String()),
            filter: t.Optional(t.String()),
            order: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
          }),
        ),
      },
      async ({ tenant, tablesService, params: { tableId }, query, request }) => {
        return tablesService.select({
          schema: 'public',
          table: tableId,
          select: query?.select,
          filter: query?.filter,
          order: query?.order,
          limit: query?.limit ? Number(query.limit) : undefined,
          offset: query?.offset ? Number(query.offset) : undefined,
          context: extractRequestContext(tenant, request),
        })
      },
    )
    .get(
      '/tables/:tableId/count',
      {
        detail: {
          summary: 'Count public table rows',
          description: 'Count rows in a table in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({ tableId: t.String({ description: 'Table name' }) }),
        query: t.Optional(t.Object({ filter: t.Optional(t.String()) })),
      },
      async ({ tenant, tablesService, params: { tableId }, query, request }) => {
        return tablesService.count({
          schema: 'public',
          table: tableId,
          filter: query?.filter,
          context: extractRequestContext(tenant, request),
        })
      },
    )
    .get(
      '/tables/:tableId/:rowId',
      {
        detail: {
          summary: 'Get public table row by ID',
          description: 'Get row by ID from a table in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({
          tableId: t.String({ description: 'Table name' }),
          rowId: t.String({ description: 'Row ID' }),
        }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String()),
            filter: t.Optional(t.String()),
          }),
        ),
      },
      async ({ tenant, tablesService, params: { tableId, rowId }, query, request }) => {
        return tablesService.getRow({
          schema: 'public',
          table: tableId,
          rowId,
          select: query?.select,
          filter: query?.filter,
          context: extractRequestContext(tenant, request),
        })
      },
    )
    .post(
      '/tables/:tableId',
      {
        detail: {
          summary: 'Insert public table row(s)',
          description: 'Insert row(s) into a table in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({ tableId: t.String({ description: 'Table name' }) }),
        query: t.Optional(
          t.Object({
            columns: t.Optional(t.String()),
            on_conflict: t.Optional(t.String()),
            ignore_duplicates: t.Optional(t.Boolean()),
            select: t.Optional(t.String()),
          }),
        ),
        body: t.Union([t.Record(t.String(), t.Any()), t.Array(t.Record(t.String(), t.Any()))]),
      },
      async ({ tenant, tablesService, params: { tableId }, query, body, request }) => {
        return tablesService.insert({
          schema: 'public',
          table: tableId,
          input: body,
          columns: query?.columns ? query.columns.split(',').map((c) => c.trim()) : undefined,
          onConflict: query?.on_conflict,
          ignoreDuplicates: query?.ignore_duplicates,
          select: query?.select,
          context: extractRequestContext(tenant, request),
        })
      },
    )
    .put(
      '/tables/:tableId',
      {
        detail: {
          summary: 'Upsert public table row(s)',
          description: 'Upsert row(s) in a table in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({ tableId: t.String({ description: 'Table name' }) }),
        query: t.Object({
          columns: t.Optional(t.String()),
          on_conflict: t.String(),
          select: t.Optional(t.String()),
        }),
        body: t.Union([t.Record(t.String(), t.Any()), t.Array(t.Record(t.String(), t.Any()))]),
      },
      async ({ tenant, tablesService, params: { tableId }, query, body, request }) => {
        return tablesService.upsert({
          schema: 'public',
          table: tableId,
          input: body,
          columns: query?.columns ? query.columns.split(',').map((c) => c.trim()) : undefined,
          onConflict: query.on_conflict,
          select: query?.select,
          context: extractRequestContext(tenant, request),
        })
      },
    )
    .patch(
      '/tables/:tableId',
      {
        detail: {
          summary: 'Update public table rows',
          description: 'Update rows in a table in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({ tableId: t.String({ description: 'Table name' }) }),
        query: t.Optional(
          t.Object({
            columns: t.Optional(t.String()),
            select: t.Optional(t.String()),
            filter: t.Optional(t.String()),
            order: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
            force: t.Optional(t.Union([t.String(), t.Boolean()])),
          }),
        ),
        body: t.Record(t.String(), t.Any()),
      },
      async ({ tenant, tablesService, params: { tableId }, query, body, request }) => {
        return tablesService.update({
          schema: 'public',
          table: tableId,
          input: body,
          columns: query?.columns ? query.columns.split(',').map((c) => c.trim()) : undefined,
          select: query?.select,
          filter: query?.filter,
          order: query?.order,
          limit: query?.limit ? Number(query.limit) : undefined,
          offset: query?.offset ? Number(query.offset) : undefined,
          force: query?.force ? String(query.force).toLowerCase() === 'true' : false,
          context: extractRequestContext(tenant, request),
        })
      },
    )
    .patch(
      '/tables/:tableId/:rowId',
      {
        detail: {
          summary: 'Update public table row by ID',
          description: 'Update a specific row by ID in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({
          tableId: t.String({ description: 'Table name' }),
          rowId: t.String({ description: 'Row ID' }),
        }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String()),
            filter: t.Optional(t.String()),
          }),
        ),
        body: t.Record(t.String(), t.Any()),
      },
      async ({ tenant, tablesService, params: { tableId, rowId }, query, body, request }) => {
        return tablesService.updateRow({
          schema: 'public',
          table: tableId,
          rowId,
          input: body,
          filter: query?.filter,
          select: query?.select,
          context: extractRequestContext(tenant, request),
        })
      },
    )
    .delete(
      '/tables/:tableId',
      {
        detail: {
          summary: 'Delete public table rows',
          description: 'Delete rows from a table in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({ tableId: t.String({ description: 'Table name' }) }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String()),
            filter: t.Optional(t.String()),
            order: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
            force: t.Optional(t.Union([t.String(), t.Boolean()])),
          }),
        ),
      },
      async ({ tenant, tablesService, params: { tableId }, query, request }) => {
        return tablesService.delete({
          schema: 'public',
          table: tableId,
          select: query?.select,
          filter: query?.filter,
          order: query?.order,
          limit: query?.limit ? Number(query.limit) : undefined,
          offset: query?.offset ? Number(query.offset) : undefined,
          force: query?.force ? String(query.force).toLowerCase() === 'true' : false,
          context: extractRequestContext(tenant, request),
        })
      },
    )
    .delete(
      '/tables/:tableId/:rowId',
      {
        detail: {
          summary: 'Delete public table row by ID',
          description: 'Delete a single row by ID from a table in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({
          tableId: t.String({ description: 'Table name' }),
          rowId: t.String({ description: 'Row ID' }),
        }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String()),
            filter: t.Optional(t.String()),
          }),
        ),
      },
      async ({ tenant, tablesService, params: { tableId, rowId }, query, request }) => {
        return tablesService.deleteRow({
          schema: 'public',
          table: tableId,
          rowId,
          filter: query?.filter,
          select: query?.select,
          context: extractRequestContext(tenant, request),
        })
      },
    )
    .get(
      '/tables/:tableId/permissions',
      {
        detail: {
          summary: 'Get public table permissions',
          description: 'Retrieve permissions for a table in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({ tableId: t.String({ description: 'Table name' }) }),
      },
      async ({ tenant, tablesService, params: { tableId } }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        return tablesService.getPermissions({
          schema: 'public',
          tableId,
        })
      },
    )
    .put(
      '/tables/:tableId/permissions',
      {
        detail: {
          summary: 'Update public table permissions',
          description: 'Update permissions for a table in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({ tableId: t.String({ description: 'Table name' }) }),
        body: t.Object({
          permissions: t.Array(t.String(), { description: 'Updated permission rules list' }),
        }),
      },
      async ({ tenant, tablesService, params: { tableId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        return tablesService.updatePermissions({
          schema: 'public',
          tableId,
          permissions: body.permissions,
        })
      },
    )
    .get(
      '/tables/:tableId/:rowId/permissions',
      {
        detail: {
          summary: 'Get public row permissions',
          description: 'Retrieve permissions for a specific row in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({
          tableId: t.String({ description: 'Table name' }),
          rowId: t.String({ description: 'Row ID' }),
        }),
      },
      async ({ tenant, tablesService, params: { tableId, rowId } }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        return tablesService.getPermissions({
          schema: 'public',
          tableId,
          rowId,
        })
      },
    )
    .put(
      '/tables/:tableId/:rowId/permissions',
      {
        detail: {
          summary: 'Update public row permissions',
          description: 'Update permissions for a specific row in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({
          tableId: t.String({ description: 'Table name' }),
          rowId: t.String({ description: 'Row ID' }),
        }),
        body: t.Object({
          permissions: t.Array(t.String(), { description: 'Updated row permissions' }),
        }),
      },
      async ({ tenant, tablesService, params: { tableId, rowId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        return tablesService.updatePermissions({
          schema: 'public',
          tableId,
          rowId,
          permissions: body.permissions,
        })
      },
    )
    .post(
      '/rpc/:functionId',
      {
        detail: {
          summary: 'Execute public stored function (RPC)',
          description: 'Execute a stored procedure in the default "public" schema.',
          tags: ['Public Tables'],
        },
        params: t.Object({ functionId: t.String({ description: 'Function name' }) }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String()),
            filter: t.Optional(t.String()),
            order: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
          }),
        ),
        body: t.Optional(t.Union([t.Record(t.String(), t.Any()), t.Array(t.Any())])),
      },
      async ({ tenant, tablesService, params: { functionId }, query, body, request }) => {
        return tablesService.callFunction({
          schema: 'public',
          functionName: functionId,
          args: (body ?? undefined) as Record<string, unknown> | unknown[] | undefined,
          select: query?.select,
          filter: query?.filter,
          order: query?.order,
          limit: query?.limit ? Number(query.limit) : undefined,
          offset: query?.offset ? Number(query.offset) : undefined,
          context: extractRequestContext(tenant, request),
        })
      },
    )
    .post(
      '/fn/:functionId',
      {
        detail: {
          summary: 'Execute public stored function alias (/fn)',
          description: 'Execute a stored procedure in the default "public" schema (alias of /rpc).',
          tags: ['Public Tables'],
        },
        params: t.Object({ functionId: t.String({ description: 'Function name' }) }),
        query: t.Optional(
          t.Object({
            select: t.Optional(t.String()),
            filter: t.Optional(t.String()),
            order: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
          }),
        ),
        body: t.Optional(t.Union([t.Record(t.String(), t.Any()), t.Array(t.Any())])),
      },
      async ({ tenant, tablesService, params: { functionId }, query, body, request }) => {
        return tablesService.callFunction({
          schema: 'public',
          functionName: functionId,
          args: (body ?? undefined) as Record<string, unknown> | unknown[] | undefined,
          select: query?.select,
          filter: query?.filter,
          order: query?.order,
          limit: query?.limit ? Number(query.limit) : undefined,
          offset: query?.offset ? Number(query.offset) : undefined,
          context: extractRequestContext(tenant, request),
        })
      },
    )
