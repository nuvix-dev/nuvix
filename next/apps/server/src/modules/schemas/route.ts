import { IndexType, OnDelete, Query, RelationType, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { TenantContext } from '../../context/tenant'
import { ForbiddenError } from '../../shared/errors'
import { AttributesService } from './attributes/service'
import { CollectionsService } from './collections/service'
import { DocumentsService } from './documents/service'
import { formatAttribute, formatCollection, formatDocument, formatIndex } from './formatter'
import { IndexesService } from './indexes/service'
import { TablesService } from './tables/service'

export interface SchemasRouteServices {
  collections?: CollectionsService
  attributes?: AttributesService
  indexes?: IndexesService
  documents?: DocumentsService
  tables?: TablesService
}

export const schemasRoutes = (services?: SchemasRouteServices) => {
  const collectionsService = services?.collections ?? new CollectionsService()
  const attributesService = services?.attributes ?? new AttributesService()
  const indexesService = services?.indexes ?? new IndexesService()
  const documentsService = services?.documents ?? new DocumentsService()

  const schemaRoutes = new Elysia({ prefix: '/schemas/:schemaId' })
    .derive('plugin', (ctx) => {
      const tenant = ctx as unknown as TenantContext
      const params = ctx.params as { schemaId: string }
      const schemaId = params?.schemaId ?? 'public'
      const tenantDb = tenant.tenantResource?.databaseForSchema(schemaId)
      const tenantSession =
        tenant.tenantResource?.sessionForSchema(schemaId, tenant.roles ?? ['guest']) ??
        (tenant.db as unknown as Session)
      const tablesService =
        services?.tables ?? new TablesService(() => tenant.tenantResource?.getSql())

      return {
        tenant,
        tenantDb,
        tenantSession,
        collectionsService,
        attributesService,
        indexesService,
        documentsService,
        tablesService,
      }
    })

    // =========================================================================
    // Collections
    // =========================================================================
    .get(
      '/collections',
      {
        params: t.Object({ schemaId: t.String() }),
        query: t.Optional(
          t.Object({
            search: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
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

    .post(
      '/collections',
      {
        params: t.Object({ schemaId: t.String() }),
        body: t.Object({
          collectionId: t.Optional(t.String()),
          name: t.String({ minLength: 1, maxLength: 255 }),
          permissions: t.Optional(t.Array(t.String())),
          documentSecurity: t.Optional(t.Boolean()),
          enabled: t.Optional(t.Boolean()),
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

    .get(
      '/collections/:collectionId',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
      },
      async ({ tenant, tenantDb, collectionsService, params: { collectionId } }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const col = await collectionsService.getCollection(tenantDb, collectionId)
        return formatCollection(col)
      },
    )

    .put(
      '/collections/:collectionId',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
          permissions: t.Optional(t.Array(t.String())),
          documentSecurity: t.Optional(t.Boolean()),
          enabled: t.Optional(t.Boolean()),
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

    .delete(
      '/collections/:collectionId',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
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

    .get(
      '/collections/:collectionId/usage',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        query: t.Optional(t.Object({ range: t.Optional(t.String()) })),
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

    // =========================================================================
    // Attributes
    // =========================================================================
    .get(
      '/collections/:collectionId/attributes',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId } }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const res = await attributesService.getAttributes(tenantDb, collectionId)
        return {
          total: res.total,
          data: res.data.map(formatAttribute),
        }
      },
    )

    .post(
      '/collections/:collectionId/attributes/string',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          key: t.String(),
          size: t.Optional(t.Number()),
          required: t.Optional(t.Boolean()),
          default: t.Optional(t.Nullable(t.String())),
          array: t.Optional(t.Boolean()),
          encrypt: t.Optional(t.Boolean()),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const attr = await attributesService.createStringAttribute(tenantDb, collectionId, body)
        return formatAttribute(attr)
      },
    )

    .post(
      '/collections/:collectionId/attributes/email',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          key: t.String(),
          required: t.Optional(t.Boolean()),
          default: t.Optional(t.Nullable(t.String())),
          array: t.Optional(t.Boolean()),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const attr = await attributesService.createEmailAttribute(tenantDb, collectionId, body)
        return formatAttribute(attr)
      },
    )

    .post(
      '/collections/:collectionId/attributes/enum',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          key: t.String(),
          elements: t.Array(t.String()),
          required: t.Optional(t.Boolean()),
          default: t.Optional(t.Nullable(t.String())),
          array: t.Optional(t.Boolean()),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const attr = await attributesService.createEnumAttribute(tenantDb, collectionId, body)
        return formatAttribute(attr)
      },
    )

    .post(
      '/collections/:collectionId/attributes/ip',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          key: t.String(),
          required: t.Optional(t.Boolean()),
          default: t.Optional(t.Nullable(t.String())),
          array: t.Optional(t.Boolean()),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const attr = await attributesService.createIPAttribute(tenantDb, collectionId, body)
        return formatAttribute(attr)
      },
    )

    .post(
      '/collections/:collectionId/attributes/url',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          key: t.String(),
          required: t.Optional(t.Boolean()),
          default: t.Optional(t.Nullable(t.String())),
          array: t.Optional(t.Boolean()),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const attr = await attributesService.createURLAttribute(tenantDb, collectionId, body)
        return formatAttribute(attr)
      },
    )

    .post(
      '/collections/:collectionId/attributes/integer',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          key: t.String(),
          min: t.Optional(t.Number()),
          max: t.Optional(t.Number()),
          required: t.Optional(t.Boolean()),
          default: t.Optional(t.Nullable(t.Number())),
          array: t.Optional(t.Boolean()),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const attr = await attributesService.createIntegerAttribute(tenantDb, collectionId, body)
        return formatAttribute(attr)
      },
    )

    .post(
      '/collections/:collectionId/attributes/float',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          key: t.String(),
          min: t.Optional(t.Number()),
          max: t.Optional(t.Number()),
          required: t.Optional(t.Boolean()),
          default: t.Optional(t.Nullable(t.Number())),
          array: t.Optional(t.Boolean()),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const attr = await attributesService.createFloatAttribute(tenantDb, collectionId, body)
        return formatAttribute(attr)
      },
    )

    .post(
      '/collections/:collectionId/attributes/boolean',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          key: t.String(),
          required: t.Optional(t.Boolean()),
          default: t.Optional(t.Nullable(t.Boolean())),
          array: t.Optional(t.Boolean()),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const attr = await attributesService.createBooleanAttribute(tenantDb, collectionId, body)
        return formatAttribute(attr)
      },
    )

    .post(
      '/collections/:collectionId/attributes/datetime',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          key: t.String(),
          required: t.Optional(t.Boolean()),
          default: t.Optional(t.Nullable(t.String())),
          array: t.Optional(t.Boolean()),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const attr = await attributesService.createDateAttribute(tenantDb, collectionId, body)
        return formatAttribute(attr)
      },
    )

    .post(
      '/collections/:collectionId/attributes/relationship',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          key: t.String(),
          relatedCollection: t.String(),
          relationType: t.Enum(RelationType),
          twoWay: t.Optional(t.Boolean()),
          twoWayKey: t.Optional(t.String()),
          onDelete: t.Optional(t.Enum(OnDelete)),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const attr = await attributesService.createRelationshipAttribute(
          tenantDb,
          collectionId,
          body,
        )
        return formatAttribute(attr)
      },
    )

    .get(
      '/collections/:collectionId/attributes/:key',
      {
        params: t.Object({
          schemaId: t.String(),
          collectionId: t.String(),
          key: t.String(),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId, key } }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const attr = await attributesService.getAttribute(tenantDb, collectionId, key)
        return formatAttribute(attr)
      },
    )

    .patch(
      '/collections/:collectionId/attributes/:key',
      {
        params: t.Object({
          schemaId: t.String(),
          collectionId: t.String(),
          key: t.String(),
        }),
        body: t.Object({
          required: t.Optional(t.Boolean()),
          default: t.Optional(t.Any()),
          size: t.Optional(t.Number()),
          min: t.Optional(t.Number()),
          max: t.Optional(t.Number()),
          elements: t.Optional(t.Array(t.String())),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId, key }, body }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        const attr = await attributesService.updateAttribute(tenantDb, collectionId, key, body)
        return formatAttribute(attr)
      },
    )

    .delete(
      '/collections/:collectionId/attributes/:key',
      {
        params: t.Object({
          schemaId: t.String(),
          collectionId: t.String(),
          key: t.String(),
        }),
      },
      async ({ tenant, tenantDb, attributesService, params: { collectionId, key }, set }) => {
        if (!tenant.isAdmin && !tenant.isAPIUser) {
          throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
        }
        await attributesService.deleteAttribute(tenantDb, collectionId, key)
        set.status = 204
        return null
      },
    )

    // =========================================================================
    // Indexes
    // =========================================================================
    .get(
      '/collections/:collectionId/indexes',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
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

    .post(
      '/collections/:collectionId/indexes',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          key: t.String(),
          type: t.Enum(IndexType),
          attributes: t.Array(t.String()),
          orders: t.Optional(t.Array(t.String())),
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

    .get(
      '/collections/:collectionId/indexes/:key',
      {
        params: t.Object({
          schemaId: t.String(),
          collectionId: t.String(),
          key: t.String(),
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

    .delete(
      '/collections/:collectionId/indexes/:key',
      {
        params: t.Object({
          schemaId: t.String(),
          collectionId: t.String(),
          key: t.String(),
        }),
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

    // =========================================================================
    // Documents
    // =========================================================================
    .get(
      '/collections/:collectionId/documents',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        query: t.Optional(
          t.Object({
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
            cursor: t.Optional(t.String()),
          }),
        ),
      },
      async ({ tenantSession, documentsService, params: { collectionId }, query }) => {
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        if (query?.cursor) queries.push(Query.cursorAfter(query.cursor))
        const res = await documentsService.getDocuments(tenantSession, collectionId, queries)
        return {
          total: res.total,
          data: res.data.map(formatDocument),
        }
      },
    )

    .post(
      '/collections/:collectionId/documents',
      {
        params: t.Object({ schemaId: t.String(), collectionId: t.String() }),
        body: t.Object({
          documentId: t.Optional(t.String()),
          data: t.Record(t.String(), t.Any()),
          permissions: t.Optional(t.Array(t.String())),
        }),
      },
      async ({ tenant, tenantSession, documentsService, params: { collectionId }, body }) => {
        const created = await documentsService.createDocument(
          tenantSession,
          collectionId,
          body,
          tenant.user,
        )
        return formatDocument(created)
      },
    )

    .get(
      '/collections/:collectionId/documents/:documentId',
      {
        params: t.Object({
          schemaId: t.String(),
          collectionId: t.String(),
          documentId: t.String(),
        }),
      },
      async ({ tenantSession, documentsService, params: { collectionId, documentId } }) => {
        const doc = await documentsService.getDocument(tenantSession, collectionId, documentId)
        return formatDocument(doc)
      },
    )

    .patch(
      '/collections/:collectionId/documents/:documentId',
      {
        params: t.Object({
          schemaId: t.String(),
          collectionId: t.String(),
          documentId: t.String(),
        }),
        body: t.Object({
          data: t.Optional(t.Record(t.String(), t.Any())),
          permissions: t.Optional(t.Array(t.String())),
        }),
      },
      async ({ tenantSession, documentsService, params: { collectionId, documentId }, body }) => {
        const updated = await documentsService.updateDocument(
          tenantSession,
          collectionId,
          documentId,
          body,
        )
        return formatDocument(updated)
      },
    )

    .delete(
      '/collections/:collectionId/documents/:documentId',
      {
        params: t.Object({
          schemaId: t.String(),
          collectionId: t.String(),
          documentId: t.String(),
        }),
      },
      async ({ tenantSession, documentsService, params: { collectionId, documentId }, set }) => {
        await documentsService.deleteDocument(tenantSession, collectionId, documentId)
        set.status = 204
        return null
      },
    )

    // =========================================================================
    // Tables (Managed & Unmanaged Schemas)
    // =========================================================================
    .get(
      '/tables/:tableId',
      {
        params: t.Object({ schemaId: t.String(), tableId: t.String() }),
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
      async ({ tablesService, params: { schemaId, tableId }, query }) => {
        return tablesService.select({
          schema: schemaId,
          table: tableId,
          select: query?.select,
          filter: query?.filter,
          order: query?.order,
          limit: query?.limit ? Number(query.limit) : undefined,
          offset: query?.offset ? Number(query.offset) : undefined,
        })
      },
    )

    .get(
      '/tables/:tableId/count',
      {
        params: t.Object({ schemaId: t.String(), tableId: t.String() }),
        query: t.Optional(
          t.Object({
            filter: t.Optional(t.String()),
          }),
        ),
      },
      async ({ tablesService, params: { schemaId, tableId }, query }) => {
        return tablesService.count({
          schema: schemaId,
          table: tableId,
          filter: query?.filter,
        })
      },
    )

    .get(
      '/tables/:tableId/:rowId',
      {
        params: t.Object({ schemaId: t.String(), tableId: t.String(), rowId: t.String() }),
      },
      async ({ tablesService, params: { schemaId, tableId, rowId } }) => {
        return tablesService.getRow({
          schema: schemaId,
          table: tableId,
          rowId,
        })
      },
    )

    .post(
      '/tables/:tableId',
      {
        params: t.Object({ schemaId: t.String(), tableId: t.String() }),
        query: t.Optional(
          t.Object({
            on_conflict: t.Optional(t.String()),
            ignore_duplicates: t.Optional(t.Boolean()),
            select: t.Optional(t.String()),
          }),
        ),
        body: t.Union([t.Record(t.String(), t.Any()), t.Array(t.Record(t.String(), t.Any()))]),
      },
      async ({ tablesService, params: { schemaId, tableId }, query, body }) => {
        return tablesService.insert({
          schema: schemaId,
          table: tableId,
          input: body,
          onConflict: query?.on_conflict,
          ignoreDuplicates: query?.ignore_duplicates,
          select: query?.select,
        })
      },
    )

    .put(
      '/tables/:tableId',
      {
        params: t.Object({ schemaId: t.String(), tableId: t.String() }),
        query: t.Object({
          on_conflict: t.String(),
          select: t.Optional(t.String()),
        }),
        body: t.Union([t.Record(t.String(), t.Any()), t.Array(t.Record(t.String(), t.Any()))]),
      },
      async ({ tablesService, params: { schemaId, tableId }, query, body }) => {
        return tablesService.upsert({
          schema: schemaId,
          table: tableId,
          input: body,
          onConflict: query.on_conflict,
          select: query?.select,
        })
      },
    )

    .patch(
      '/tables/:tableId',
      {
        params: t.Object({ schemaId: t.String(), tableId: t.String() }),
        query: t.Optional(
          t.Object({
            filter: t.Optional(t.String()),
          }),
        ),
        body: t.Record(t.String(), t.Any()),
      },
      async ({ tablesService, params: { schemaId, tableId }, query, body }) => {
        return tablesService.update({
          schema: schemaId,
          table: tableId,
          input: body,
          filter: query?.filter,
        })
      },
    )

    .patch(
      '/tables/:tableId/:rowId',
      {
        params: t.Object({ schemaId: t.String(), tableId: t.String(), rowId: t.String() }),
        body: t.Record(t.String(), t.Any()),
      },
      async ({ tablesService, params: { schemaId, tableId, rowId }, body }) => {
        return tablesService.updateRow({
          schema: schemaId,
          table: tableId,
          rowId,
          input: body,
        })
      },
    )

    .delete(
      '/tables/:tableId',
      {
        params: t.Object({ schemaId: t.String(), tableId: t.String() }),
        query: t.Optional(
          t.Object({
            filter: t.Optional(t.String()),
          }),
        ),
      },
      async ({ tablesService, params: { schemaId, tableId }, query }) => {
        return tablesService.delete({
          schema: schemaId,
          table: tableId,
          filter: query?.filter,
        })
      },
    )

    .delete(
      '/tables/:tableId/:rowId',
      {
        params: t.Object({ schemaId: t.String(), tableId: t.String(), rowId: t.String() }),
      },
      async ({ tablesService, params: { schemaId, tableId, rowId } }) => {
        return tablesService.deleteRow({
          schema: schemaId,
          table: tableId,
          rowId,
        })
      },
    )

    // =========================================================================
    // Database Functions / Stored Procedures (RPC)
    // =========================================================================
    .post(
      '/rpc/:functionId',
      {
        params: t.Object({ schemaId: t.String(), functionId: t.String() }),
        body: t.Optional(t.Union([t.Record(t.String(), t.Any()), t.Array(t.Any())])),
      },
      async ({ tablesService, params: { schemaId, functionId }, body }) => {
        return tablesService.callFunction({
          schema: schemaId,
          functionName: functionId,
          args: (body ?? undefined) as Record<string, unknown> | unknown[] | undefined,
        })
      },
    )

    .post(
      '/fn/:functionId',
      {
        params: t.Object({ schemaId: t.String(), functionId: t.String() }),
        body: t.Optional(t.Union([t.Record(t.String(), t.Any()), t.Array(t.Any())])),
      },
      async ({ tablesService, params: { schemaId, functionId }, body }) => {
        return tablesService.callFunction({
          schema: schemaId,
          functionName: functionId,
          args: (body ?? undefined) as Record<string, unknown> | unknown[] | undefined,
        })
      },
    )

  // =========================================================================
  // Public Tables / RPC Shorthand (/public/tables/*, /public/rpc/*)
  // =========================================================================
  const publicRoutes = new Elysia({ prefix: '/public' })

    .derive('plugin', (ctx) => {
      const tenant = ctx as unknown as TenantContext
      const tablesService =
        services?.tables ?? new TablesService(() => tenant.tenantResource?.getSql())
      return { tablesService }
    })
    .get(
      '/tables/:tableId',
      {
        params: t.Object({ tableId: t.String() }),
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
      async ({ tablesService, params: { tableId }, query }) => {
        return tablesService.select({
          schema: 'public',
          table: tableId,
          select: query?.select,
          filter: query?.filter,
          order: query?.order,
          limit: query?.limit ? Number(query.limit) : undefined,
          offset: query?.offset ? Number(query.offset) : undefined,
        })
      },
    )
    .get(
      '/tables/:tableId/count',
      {
        params: t.Object({ tableId: t.String() }),
        query: t.Optional(
          t.Object({
            filter: t.Optional(t.String()),
          }),
        ),
      },
      async ({ tablesService, params: { tableId }, query }) => {
        return tablesService.count({
          schema: 'public',
          table: tableId,
          filter: query?.filter,
        })
      },
    )
    .get(
      '/tables/:tableId/:rowId',
      {
        params: t.Object({ tableId: t.String(), rowId: t.String() }),
      },
      async ({ tablesService, params: { tableId, rowId } }) => {
        return tablesService.getRow({
          schema: 'public',
          table: tableId,
          rowId,
        })
      },
    )
    .post(
      '/tables/:tableId',
      {
        params: t.Object({ tableId: t.String() }),
        query: t.Optional(
          t.Object({
            on_conflict: t.Optional(t.String()),
            ignore_duplicates: t.Optional(t.Boolean()),
            select: t.Optional(t.String()),
          }),
        ),
        body: t.Union([t.Record(t.String(), t.Any()), t.Array(t.Record(t.String(), t.Any()))]),
      },
      async ({ tablesService, params: { tableId }, query, body }) => {
        return tablesService.insert({
          schema: 'public',
          table: tableId,
          input: body,
          onConflict: query?.on_conflict,
          ignoreDuplicates: query?.ignore_duplicates,
          select: query?.select,
        })
      },
    )
    .put(
      '/tables/:tableId',
      {
        params: t.Object({ tableId: t.String() }),
        query: t.Object({
          on_conflict: t.String(),
          select: t.Optional(t.String()),
        }),
        body: t.Union([t.Record(t.String(), t.Any()), t.Array(t.Record(t.String(), t.Any()))]),
      },
      async ({ tablesService, params: { tableId }, query, body }) => {
        return tablesService.upsert({
          schema: 'public',
          table: tableId,
          input: body,
          onConflict: query.on_conflict,
          select: query?.select,
        })
      },
    )
    .patch(
      '/tables/:tableId',
      {
        params: t.Object({ tableId: t.String() }),
        query: t.Optional(
          t.Object({
            filter: t.Optional(t.String()),
          }),
        ),
        body: t.Record(t.String(), t.Any()),
      },
      async ({ tablesService, params: { tableId }, query, body }) => {
        return tablesService.update({
          schema: 'public',
          table: tableId,
          input: body,
          filter: query?.filter,
        })
      },
    )
    .patch(
      '/tables/:tableId/:rowId',
      {
        params: t.Object({ tableId: t.String(), rowId: t.String() }),
        body: t.Record(t.String(), t.Any()),
      },
      async ({ tablesService, params: { tableId, rowId }, body }) => {
        return tablesService.updateRow({
          schema: 'public',
          table: tableId,
          rowId,
          input: body,
        })
      },
    )
    .delete(
      '/tables/:tableId',
      {
        params: t.Object({ tableId: t.String() }),
        query: t.Optional(
          t.Object({
            filter: t.Optional(t.String()),
          }),
        ),
      },
      async ({ tablesService, params: { tableId }, query }) => {
        return tablesService.delete({
          schema: 'public',
          table: tableId,
          filter: query?.filter,
        })
      },
    )
    .delete(
      '/tables/:tableId/:rowId',
      {
        params: t.Object({ tableId: t.String(), rowId: t.String() }),
      },
      async ({ tablesService, params: { tableId, rowId } }) => {
        return tablesService.deleteRow({
          schema: 'public',
          table: tableId,
          rowId,
        })
      },
    )
    .post(
      '/rpc/:functionId',
      {
        params: t.Object({ functionId: t.String() }),
        body: t.Optional(t.Union([t.Record(t.String(), t.Any()), t.Array(t.Any())])),
      },
      async ({ tablesService, params: { functionId }, body }) => {
        return tablesService.callFunction({
          schema: 'public',
          functionName: functionId,
          args: (body ?? undefined) as Record<string, unknown> | unknown[] | undefined,
        })
      },
    )
    .post(
      '/fn/:functionId',
      {
        params: t.Object({ functionId: t.String() }),
        body: t.Optional(t.Union([t.Record(t.String(), t.Any()), t.Array(t.Any())])),
      },
      async ({ tablesService, params: { functionId }, body }) => {
        return tablesService.callFunction({
          schema: 'public',
          functionName: functionId,
          args: (body ?? undefined) as Record<string, unknown> | unknown[] | undefined,
        })
      },
    )

  return new Elysia().use(schemaRoutes).use(publicRoutes)
}
