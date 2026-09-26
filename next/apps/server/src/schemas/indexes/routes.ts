import { IndexType } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { TenantContext } from '../../context/tenant'
import { ForbiddenError } from '../../shared/errors'
import { formatIndex } from '../formatter'
import { IndexesService } from './service'

export interface IndexesRouteServices {
  indexes?: IndexesService
}

export const indexesRoutes = (services?: IndexesRouteServices) => {
  const defaultService = services?.indexes ?? new IndexesService()

  return (
    new Elysia()
      .derive('plugin', (ctx) => {
        const tenant = ctx as unknown as TenantContext
        const params = ctx.params as { schemaId: string }
        const schemaId = params?.schemaId ?? 'public'
        const tenantDb = tenant.tenantResource?.databaseForSchema(schemaId)
        return {
          tenant,
          tenantDb,
          indexesService: defaultService,
        }
      })

      // 1. List indexes
      .get(
        '/collections/:collectionId/indexes',
        {
          detail: {
            summary: 'List collection indexes',
            description: 'Retrieve a list of database indexes configured on the collection.',
            tags: ['Schemas Indexes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
        },
        async ({ tenant, tenantDb, indexesService, params: { collectionId } }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const res = await indexesService.getIndexes(tenantDb, collectionId)
          return {
            total: res.total,
            data: res.data.map(formatIndex),
          }
        },
      )

      // 2. Create index
      .post(
        '/collections/:collectionId/indexes',
        {
          detail: {
            summary: 'Create collection index',
            description:
              'Create a new database index (key, unique, fulltext) across one or more attributes.',
            tags: ['Schemas Indexes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          body: t.Object({
            key: t.String({ description: 'Index unique key identifier' }),
            type: t.Enum(IndexType, { description: 'Index type: key, unique, or fulltext' }),
            attributes: t.Array(t.String({ description: 'Indexed attribute key' }), {
              description: 'Ordered list of attribute keys included in index',
            }),
            orders: t.Optional(
              t.Array(t.String({ description: 'Sort order: ASC or DESC' }), {
                description: 'Sort ordering for each indexed attribute',
              }),
            ),
          }),
        },
        async ({ tenant, tenantDb, indexesService, params: { collectionId }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const idx = await indexesService.createIndex(tenantDb, collectionId, body)
          return formatIndex(idx)
        },
      )

      // 3. Get index by key
      .get(
        '/collections/:collectionId/indexes/:key',
        {
          detail: {
            summary: 'Get collection index by key',
            description: 'Retrieve definition and status for a specific database index.',
            tags: ['Schemas Indexes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
            key: t.String({ description: 'Index key identifier' }),
          }),
        },
        async ({ tenant, tenantDb, indexesService, params: { collectionId, key } }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const idx = await indexesService.getIndex(tenantDb, collectionId, key)
          return formatIndex(idx)
        },
      )

      // 4. Delete index by key
      .delete(
        '/collections/:collectionId/indexes/:key',
        {
          detail: {
            summary: 'Delete collection index by key',
            description: 'Drop and delete an existing database index from the collection.',
            tags: ['Schemas Indexes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
            key: t.String({ description: 'Index key identifier' }),
          }),
          response: {
            204: t.Null({ description: 'Index deleted successfully (no content)' }),
          },
        },
        async ({ tenant, tenantDb, indexesService, params: { collectionId, key }, set }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          await indexesService.deleteIndex(tenantDb, collectionId, key)
          set.status = 204
          return null
        },
      )
  )
}
