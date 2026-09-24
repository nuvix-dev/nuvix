import { Elysia, t } from 'elysia'
import type { KeysService } from './service'

const KeySchema = t.Object({
  $id: t.String(),
  projectId: t.String(),
  name: t.String(),
  scopes: t.Array(t.String()),
  secret: t.String(),
  expire: t.Nullable(t.Any()),
  accessedAt: t.Nullable(t.Any()),
  sdks: t.Array(t.String()),
  $createdAt: t.Any(),
  $updatedAt: t.Any(),
})

export function keyRoutes(service: KeysService) {
  return new Elysia({ name: 'key-routes' })
    .post(
      '/projects/:projectId/keys',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 128 }),
          scopes: t.Optional(t.Array(t.String())),
          expire: t.Optional(t.Nullable(t.String())),
        }),
        response: KeySchema,
        detail: { summary: 'Create an API key', tags: ['keys'] },
      },
      ({ params: { projectId }, body }) =>
        service.create(projectId, {
          name: body.name,
          scopes: body.scopes,
          expire: body.expire,
        }),
    )
    .get(
      '/projects/:projectId/keys',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
          offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
        }),
        response: t.Object({
          data: t.Array(KeySchema),
          meta: t.Object({
            total: t.Number(),
            limit: t.Number(),
            offset: t.Number(),
          }),
        }),
        detail: { summary: 'List API keys', tags: ['keys'] },
      },
      async ({ params: { projectId }, query }) => {
        const limit = query.limit ?? 25
        const offset = query.offset ?? 0
        const { keys, total } = await service.list(projectId, limit, offset)
        return { data: keys, meta: { total, limit, offset } }
      },
    )
    .get(
      '/projects/:projectId/keys/:keyId',
      {
        params: t.Object({ projectId: t.String(), keyId: t.String() }),
        response: KeySchema,
        detail: { summary: 'Get an API key', tags: ['keys'] },
      },
      ({ params: { projectId, keyId } }) => service.get(projectId, keyId),
    )
    .put(
      '/projects/:projectId/keys/:keyId',
      {
        params: t.Object({ projectId: t.String(), keyId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          scopes: t.Optional(t.Array(t.String())),
          expire: t.Optional(t.Nullable(t.String())),
        }),
        response: KeySchema,
        detail: { summary: 'Update an API key', tags: ['keys'] },
      },
      ({ params: { projectId, keyId }, body }) =>
        service.update(projectId, keyId, {
          name: body.name,
          scopes: body.scopes,
          expire: body.expire,
        }),
    )
    .patch(
      '/projects/:projectId/keys/:keyId',
      {
        params: t.Object({ projectId: t.String(), keyId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          scopes: t.Optional(t.Array(t.String())),
          expire: t.Optional(t.Nullable(t.String())),
        }),
        response: KeySchema,
        detail: { summary: 'Update an API key', tags: ['keys'] },
      },
      ({ params: { projectId, keyId }, body }) =>
        service.update(projectId, keyId, {
          name: body.name,
          scopes: body.scopes,
          expire: body.expire,
        }),
    )
    .delete(
      '/projects/:projectId/keys/:keyId',
      {
        params: t.Object({ projectId: t.String(), keyId: t.String() }),
        response: t.Object({ status: t.Literal('ok') }),
        detail: { summary: 'Delete an API key', tags: ['keys'] },
      },
      async ({ params: { projectId, keyId } }) => {
        await service.delete(projectId, keyId)
        return { status: 'ok' as const }
      },
    )
}
