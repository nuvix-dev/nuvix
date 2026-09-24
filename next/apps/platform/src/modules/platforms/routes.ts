import { Elysia, t } from 'elysia'
import type { PlatformsService } from './service'

const PlatformSchema = t.Object({
  $id: t.String(),
  projectId: t.String(),
  type: t.String(),
  name: t.String(),
  key: t.Nullable(t.String()),
  store: t.Nullable(t.String()),
  hostname: t.Nullable(t.String()),
  $createdAt: t.Any(),
  $updatedAt: t.Any(),
})

export function platformRoutes(service: PlatformsService) {
  return new Elysia({ name: 'platform-routes' })
    .post(
      '/projects/:projectId/platforms',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          type: t.String({ minLength: 1, maxLength: 32 }),
          name: t.String({ minLength: 1, maxLength: 128 }),
          key: t.Optional(t.Nullable(t.String())),
          store: t.Optional(t.Nullable(t.String())),
          hostname: t.Optional(t.Nullable(t.String())),
        }),
        response: PlatformSchema,
        detail: { summary: 'Create a client platform', tags: ['platforms'] },
      },
      ({ params: { projectId }, body }) => service.create(projectId, body),
    )
    .get(
      '/projects/:projectId/platforms',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
          offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
        }),
        response: t.Object({
          data: t.Array(PlatformSchema),
          meta: t.Object({
            total: t.Number(),
            limit: t.Number(),
            offset: t.Number(),
          }),
        }),
        detail: { summary: 'List client platforms', tags: ['platforms'] },
      },
      async ({ params: { projectId }, query }) => {
        const limit = query.limit ?? 25
        const offset = query.offset ?? 0
        const { platforms, total } = await service.list(projectId, limit, offset)
        return { data: platforms, meta: { total, limit, offset } }
      },
    )
    .get(
      '/projects/:projectId/platforms/:platformId',
      {
        params: t.Object({ projectId: t.String(), platformId: t.String() }),
        response: PlatformSchema,
        detail: { summary: 'Get a client platform', tags: ['platforms'] },
      },
      ({ params: { projectId, platformId } }) => service.get(projectId, platformId),
    )
    .put(
      '/projects/:projectId/platforms/:platformId',
      {
        params: t.Object({ projectId: t.String(), platformId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          key: t.Optional(t.Nullable(t.String())),
          store: t.Optional(t.Nullable(t.String())),
          hostname: t.Optional(t.Nullable(t.String())),
        }),
        response: PlatformSchema,
        detail: { summary: 'Update a client platform', tags: ['platforms'] },
      },
      ({ params: { projectId, platformId }, body }) => service.update(projectId, platformId, body),
    )
    .patch(
      '/projects/:projectId/platforms/:platformId',
      {
        params: t.Object({ projectId: t.String(), platformId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          key: t.Optional(t.Nullable(t.String())),
          store: t.Optional(t.Nullable(t.String())),
          hostname: t.Optional(t.Nullable(t.String())),
        }),
        response: PlatformSchema,
        detail: { summary: 'Update a client platform', tags: ['platforms'] },
      },
      ({ params: { projectId, platformId }, body }) => service.update(projectId, platformId, body),
    )
    .delete(
      '/projects/:projectId/platforms/:platformId',
      {
        params: t.Object({ projectId: t.String(), platformId: t.String() }),
        response: t.Object({ status: t.Literal('ok') }),
        detail: { summary: 'Delete a client platform', tags: ['platforms'] },
      },
      async ({ params: { projectId, platformId } }) => {
        await service.delete(projectId, platformId)
        return { status: 'ok' as const }
      },
    )
}
