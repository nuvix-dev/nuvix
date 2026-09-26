import { Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { TenantContext } from '../../context/tenant'
import { formatDocument } from '../formatter'
import { DocumentsService } from './service'

export interface DocumentsRouteServices {
  documents?: DocumentsService
}

export const documentsRoutes = (services?: DocumentsRouteServices) => {
  const defaultService = services?.documents ?? new DocumentsService()

  return (
    new Elysia()
      .derive('plugin', (ctx) => {
        const tenant = ctx as unknown as TenantContext
        const params = ctx.params as { schemaId: string }
        const schemaId = params?.schemaId ?? 'public'
        const tenantSession =
          tenant.tenantResource?.sessionForSchema(schemaId, tenant.roles ?? ['guest']) ??
          (tenant.db as unknown as Session)
        return {
          tenant,
          tenantSession,
          documentsService: defaultService,
        }
      })

      // 1. List documents
      .get(
        '/collections/:collectionId/documents',
        {
          detail: {
            summary: 'List documents',
            description:
              'Retrieve a paginated list of documents from a collection with optional cursor pagination and limit.',
            tags: ['Schemas Documents'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          query: t.Optional(
            t.Object({
              limit: t.Optional(t.String({ description: 'Maximum number of documents to return' })),
              offset: t.Optional(t.String({ description: 'Number of documents to skip' })),
              cursor: t.Optional(
                t.String({ description: 'Cursor pagination token for the next page' }),
              ),
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

      // 2. Create document
      .post(
        '/collections/:collectionId/documents',
        {
          detail: {
            summary: 'Create document',
            description:
              'Insert a new document with attribute data and optional permissions into the collection.',
            tags: ['Schemas Documents'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          body: t.Object({
            documentId: t.Optional(t.String({ description: 'Custom unique document identifier' })),
            data: t.Record(t.String(), t.Any(), {
              description:
                'JSON object containing field values corresponding to collection attributes',
            }),
            permissions: t.Optional(
              t.Array(t.String({ description: 'Permission string' }), {
                description: 'Explicit document-level access permissions list',
              }),
            ),
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

      // 3. Get document by ID
      .get(
        '/collections/:collectionId/documents/:documentId',
        {
          detail: {
            summary: 'Get document by ID',
            description: 'Retrieve full document data and metadata for a specific document.',
            tags: ['Schemas Documents'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
            documentId: t.String({ description: 'Unique document identifier' }),
          }),
        },
        async ({ tenantSession, documentsService, params: { collectionId, documentId } }) => {
          const doc = await documentsService.getDocument(tenantSession, collectionId, documentId)
          return formatDocument(doc)
        },
      )

      // 4. Update document by ID
      .patch(
        '/collections/:collectionId/documents/:documentId',
        {
          detail: {
            summary: 'Update document by ID',
            description: 'Partially update field data or permissions of an existing document.',
            tags: ['Schemas Documents'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
            documentId: t.String({ description: 'Unique document identifier' }),
          }),
          body: t.Object({
            data: t.Optional(
              t.Record(t.String(), t.Any(), {
                description: 'Updated field key-value pairs',
              }),
            ),
            permissions: t.Optional(
              t.Array(t.String({ description: 'Permission string' }), {
                description: 'Updated document permissions list',
              }),
            ),
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

      // 5. Delete document by ID
      .delete(
        '/collections/:collectionId/documents/:documentId',
        {
          detail: {
            summary: 'Delete document by ID',
            description: 'Permanently delete a document from the collection.',
            tags: ['Schemas Documents'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
            documentId: t.String({ description: 'Unique document identifier' }),
          }),
          response: {
            204: t.Null({ description: 'Document deleted successfully (no content)' }),
          },
        },
        async ({ tenantSession, documentsService, params: { collectionId, documentId }, set }) => {
          await documentsService.deleteDocument(tenantSession, collectionId, documentId)
          set.status = 204
          return null
        },
      )
  )
}
