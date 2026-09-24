import { Elysia, t } from 'elysia'
import type { TenantContext } from '../../context/tenant'
import { ForbiddenError } from '../../shared/errors'
import { DatabaseService, type SchemaStorage } from './service'

export const databaseRoutes = (storage?: SchemaStorage) =>
  new Elysia({ prefix: '/database' })
    .derive('plugin', (ctx) => {
      const tenant = ctx as unknown as TenantContext
      if (!tenant.isAdmin && !tenant.isAPIUser) {
        throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
      }
      return {
        service: new DatabaseService(tenant.tenantResource, storage),
      }
    })

    .get(
      '/schemas',
      {
        query: t.Optional(
          t.Object({
            type: t.Optional(
              t.Union([t.Literal('managed'), t.Literal('unmanaged'), t.Literal('document')]),
            ),
          }),
        ),
      },
      async ({ service, query }) => {
        return service.getSchemas(query?.type)
      },
    )

    .post(
      '/schemas',
      {
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 255 }),
          type: t.Union([t.Literal('managed'), t.Literal('unmanaged'), t.Literal('document')]),
          description: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
        }),
      },
      async ({ service, body }) => {
        if (body.type === 'document') {
          return service.createDocumentSchema(body)
        }
        return service.createSchema(body)
      },
    )

    .get(
      '/schemas/:schemaId',
      {
        params: t.Object({ schemaId: t.String() }),
      },
      async ({ service, params: { schemaId } }) => {
        return service.getSchema(schemaId)
      },
    )

    .patch(
      '/schemas/:schemaId',
      {
        params: t.Object({ schemaId: t.String() }),
        body: t.Object({
          description: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
        }),
      },
      async ({ service, params: { schemaId }, body }) => {
        return service.updateSchema(schemaId, body.description)
      },
    )

    .delete(
      '/schemas/:schemaId',
      {
        params: t.Object({ schemaId: t.String() }),
      },
      async ({ service, params: { schemaId }, set }) => {
        await service.deleteSchema(schemaId)
        set.status = 204
        return null
      },
    )
