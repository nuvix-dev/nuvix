import { Elysia, t } from 'elysia'
import type { TenantContext } from '../../context/tenant'
import { ForbiddenError } from '../../shared/errors'
import { DatabaseService, type SchemaStorage } from './service'

export const databaseSchemasRoutes = (storage?: SchemaStorage) =>
  new Elysia()
    .derive('plugin', (ctx) => {
      const tenant = ctx as unknown as TenantContext
      if (!tenant.isAdmin && !tenant.isAPIUser) {
        throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
      }
      return {
        service: new DatabaseService(tenant.tenantResource, storage),
      }
    })

    // 1. List schemas
    .get(
      '/schemas',
      {
        detail: {
          summary: 'List database schemas',
          description:
            'Retrieve a list of database schemas belonging to the tenant, filtered optionally by schema type.',
          tags: ['Database Schemas'],
        },
        query: t.Optional(
          t.Object({
            type: t.Optional(
              t.Union([t.Literal('managed'), t.Literal('unmanaged'), t.Literal('document')], {
                description: 'Filter schemas by type: managed, unmanaged, or document',
              }),
            ),
          }),
        ),
      },
      async ({ service, query }) => {
        return service.getSchemas(query?.type)
      },
    )

    // 2. Create schema
    .post(
      '/schemas',
      {
        detail: {
          summary: 'Create database schema',
          description:
            'Create a new PostgreSQL database schema with specified management type and description.',
          tags: ['Database Schemas'],
        },
        body: t.Object({
          name: t.String({
            description: 'PostgreSQL schema name (must be a valid SQL identifier)',
            minLength: 1,
            maxLength: 255,
          }),
          type: t.Union([t.Literal('managed'), t.Literal('unmanaged'), t.Literal('document')], {
            description:
              'Schema management type: managed (Nuvix managed), unmanaged (external), or document',
          }),
          description: t.Optional(
            t.Nullable(
              t.String({
                description: 'Optional human-readable description of the schema',
                maxLength: 255,
              }),
            ),
          ),
        }),
      },
      async ({ service, body }) => {
        if (body.type === 'document') {
          return service.createDocumentSchema(body)
        }
        return service.createSchema(body)
      },
    )

    // 3. Get schema by ID
    .get(
      '/schemas/:schemaId',
      {
        detail: {
          summary: 'Get database schema by ID',
          description: 'Retrieve details, type, and description of a specific database schema.',
          tags: ['Database Schemas'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Schema name or identifier' }),
        }),
      },
      async ({ service, params: { schemaId } }) => {
        return service.getSchema(schemaId)
      },
    )

    // 4. Update schema description
    .patch(
      '/schemas/:schemaId',
      {
        detail: {
          summary: 'Update database schema',
          description: 'Update the metadata description of an existing database schema.',
          tags: ['Database Schemas'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Schema name or identifier' }),
        }),
        body: t.Object({
          description: t.Optional(
            t.Nullable(
              t.String({
                description: 'Updated schema description',
                maxLength: 255,
              }),
            ),
          ),
        }),
      },
      async ({ service, params: { schemaId }, body }) => {
        return service.updateSchema(schemaId, body.description)
      },
    )

    // 5. Delete schema
    .delete(
      '/schemas/:schemaId',
      {
        detail: {
          summary: 'Delete database schema',
          description: 'Drop and delete an existing database schema and its internal metadata.',
          tags: ['Database Schemas'],
        },
        params: t.Object({
          schemaId: t.String({ description: 'Schema name or identifier' }),
        }),
        response: {
          204: t.Null({ description: 'Schema deleted successfully (no content)' }),
        },
      },
      async ({ service, params: { schemaId }, set }) => {
        await service.deleteSchema(schemaId)
        set.status = 204
        return null
      },
    )
