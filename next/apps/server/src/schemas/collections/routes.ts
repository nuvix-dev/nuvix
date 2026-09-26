import { Query } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { TenantContext } from '../../context/tenant'
import { ForbiddenError } from '../../shared/errors'
import { formatCollection } from '../formatter'
import { CollectionsService } from './service'

export interface CollectionsRouteServices {
  collections?: CollectionsService
}

export const collectionsRoutes = (services?: CollectionsRouteServices) => {
  const defaultService = services?.collections ?? new CollectionsService()

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
          collectionsService: defaultService,
        }
      })

      // 1. List collections
      .get(
        '/collections',
        {
          detail: {
            summary: 'List collections',
            description:
              'Retrieve a list of document collections defined in the specified database schema.',
            tags: ['Schemas Collections'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema name or identifier' }),
          }),
          query: t.Optional(
            t.Object({
              search: t.Optional(
                t.String({ description: 'Filter collections matching search query' }),
              ),
              limit: t.Optional(
                t.String({ description: 'Maximum number of collections to return' }),
              ),
              offset: t.Optional(t.String({ description: 'Number of collections to skip' })),
            }),
          ),
        },
        async ({ tenant, tenantDb, collectionsService, query }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const queries: Query[] = []
          if (query?.limit) queries.push(Query.limit(Number(query.limit)))
          if (query?.offset) queries.push(Query.offset(Number(query.offset)))
          const res = await collectionsService.getCollections(tenantDb, queries, query?.search)
          return {
            total: res.total,
            data: res.data.map(formatCollection),
          }
        },
      )

      // 2. Create collection
      .post(
        '/collections',
        {
          detail: {
            summary: 'Create collection',
            description: 'Create a new document collection within the specified database schema.',
            tags: ['Schemas Collections'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema name or identifier' }),
          }),
          body: t.Object({
            collectionId: t.Optional(
              t.String({ description: 'Custom unique collection identifier' }),
            ),
            name: t.String({
              description: 'Human-readable collection name',
              minLength: 1,
              maxLength: 255,
            }),
            permissions: t.Optional(
              t.Array(t.String({ description: 'Permission rule string' }), {
                description: 'Default collection-level access permissions list',
              }),
            ),
            documentSecurity: t.Optional(
              t.Boolean({
                description: 'Whether per-document row-level security permissions are enabled',
              }),
            ),
            enabled: t.Optional(
              t.Boolean({
                description: 'Whether the collection is active and available for queries',
              }),
            ),
          }),
        },
        async ({ tenant, tenantDb, collectionsService, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const created = await collectionsService.createCollection(tenantDb, body)
          return formatCollection(created)
        },
      )

      // 3. Get collection by ID
      .get(
        '/collections/:collectionId',
        {
          detail: {
            summary: 'Get collection by ID',
            description: 'Retrieve metadata, attributes, and indexes for a specific collection.',
            tags: ['Schemas Collections'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema name or identifier' }),
            collectionId: t.String({ description: 'Collection unique identifier' }),
          }),
        },
        async ({ tenant, tenantDb, collectionsService, params: { collectionId } }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const col = await collectionsService.getCollection(tenantDb, collectionId)
          return formatCollection(col)
        },
      )

      // 4. Update collection
      .put(
        '/collections/:collectionId',
        {
          detail: {
            summary: 'Update collection',
            description: 'Update name, permissions, or security flags for an existing collection.',
            tags: ['Schemas Collections'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema name or identifier' }),
            collectionId: t.String({ description: 'Collection unique identifier' }),
          }),
          body: t.Object({
            name: t.Optional(
              t.String({
                description: 'Updated collection display name',
                minLength: 1,
                maxLength: 255,
              }),
            ),
            permissions: t.Optional(
              t.Array(t.String({ description: 'Permission string' }), {
                description: 'Updated collection permissions',
              }),
            ),
            documentSecurity: t.Optional(
              t.Boolean({ description: 'Document-level security flag' }),
            ),
            enabled: t.Optional(t.Boolean({ description: 'Collection enabled status' })),
          }),
        },
        async ({ tenant, tenantDb, collectionsService, params: { collectionId }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const updated = await collectionsService.updateCollection(tenantDb, collectionId, body)
          return formatCollection(updated)
        },
      )

      // 5. Delete collection
      .delete(
        '/collections/:collectionId',
        {
          detail: {
            summary: 'Delete collection',
            description:
              'Permanently drop and delete a document collection along with all contained documents, attributes, and indexes.',
            tags: ['Schemas Collections'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema name or identifier' }),
            collectionId: t.String({ description: 'Collection unique identifier' }),
          }),
          response: {
            204: t.Null({ description: 'Collection deleted successfully (no content)' }),
          },
        },
        async ({ tenant, tenantDb, collectionsService, params: { collectionId }, set }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          await collectionsService.removeCollection(tenantDb, collectionId)
          set.status = 204
          return null
        },
      )

      // 6. Get collection usage
      .get(
        '/collections/:collectionId/usage',
        {
          detail: {
            summary: 'Get collection usage',
            description: 'Retrieve storage usage and document count metrics for a collection.',
            tags: ['Schemas Collections'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema name or identifier' }),
            collectionId: t.String({ description: 'Collection unique identifier' }),
          }),
          query: t.Optional(
            t.Object({
              range: t.Optional(
                t.String({ description: 'Usage time window range (e.g. 24h, 7d, 30d)' }),
              ),
            }),
          ),
        },
        async ({ tenant, tenantDb, collectionsService, params: { collectionId }, query }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const usage = await collectionsService.getCollectionUsage(
            tenantDb,
            collectionId,
            query?.range,
          )
          return usage.toObject()
        },
      )
  )
}
