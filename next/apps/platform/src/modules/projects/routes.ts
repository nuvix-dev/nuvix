/**
 * Project routes — thin HTTP layer over `ProjectService`.
 * Contract: docs/api/platform.md
 *
 * NOTE (elysia 2.0.0-beta.6): route signature is `.get(path, hook, handler)` —
 * the schema/hook object comes BEFORE the handler.
 */

import { Elysia, t } from 'elysia'
import type { ProjectService } from './service'

export const ProjectSchema = t.Object({
  $id: t.String(),
  name: t.String(),
  status: t.Union([t.Literal('provisioning'), t.Literal('active'), t.Literal('error')]),
  publishableKey: t.String(),
  containerName: t.String(),
  volumeName: t.String(),
  errorMessage: t.Optional(t.String()),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  logo: t.Optional(t.Union([t.String(), t.Null()])),
  url: t.Optional(t.Union([t.String(), t.Null()])),
  services: t.Optional(t.Record(t.String(), t.Unknown())),
  apis: t.Optional(t.Record(t.String(), t.Unknown())),
  oAuthProviders: t.Optional(t.Array(t.Unknown())),
  smtp: t.Optional(t.Record(t.String(), t.Unknown())),
  metadata: t.Optional(t.Record(t.String(), t.Unknown())),
  templates: t.Optional(t.Record(t.String(), t.Unknown())),
  auths: t.Optional(t.Record(t.String(), t.Unknown())),
  $createdAt: t.Any(),
  $updatedAt: t.Any(),
})

export function projectRoutes(service: ProjectService) {
  return new Elysia({ name: 'project-routes' })
    .post(
      '/projects',
      {
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 128 }),
          id: t.Optional(t.String({ maxLength: 36 })),
          description: t.Optional(t.String({ maxLength: 512 })),
          logo: t.Optional(t.String({ maxLength: 255 })),
          url: t.Optional(t.String({ maxLength: 2048 })),
        }),
        response: ProjectSchema,
        detail: { summary: 'Create a project', tags: ['projects'] },
      },
      ({ body }) => service.create(body),
    )
    .get(
      '/projects',
      {
        query: t.Object({
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
          offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
        }),
        response: t.Object({
          data: t.Array(ProjectSchema),
          meta: t.Object({
            total: t.Number(),
            limit: t.Number(),
            offset: t.Number(),
          }),
        }),
        detail: { summary: 'List projects', tags: ['projects'] },
      },
      async ({ query }) => {
        const limit = query.limit ?? 25
        const offset = query.offset ?? 0
        const { projects, total } = await service.list(limit, offset)
        return { data: projects, meta: { total, limit, offset } }
      },
    )
    .get(
      '/projects/:projectId',
      {
        params: t.Object({ projectId: t.String() }),
        response: ProjectSchema,
        detail: { summary: 'Get a project', tags: ['projects'] },
      },
      ({ params }) => service.get(params.projectId),
    )
    .patch(
      '/projects/:projectId',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
          description: t.Optional(t.String({ maxLength: 512 })),
          logo: t.Optional(t.String({ maxLength: 255 })),
          url: t.Optional(t.String({ maxLength: 2048 })),
        }),
        response: ProjectSchema,
        detail: { summary: 'Update a project', tags: ['projects'] },
      },
      ({ params, body }) => service.update(params.projectId, body),
    )
    .delete(
      '/projects/:projectId',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({ purge: t.Optional(t.Boolean({ default: false })) }),
        response: t.Void(),
        detail: { summary: 'Delete a project', tags: ['projects'] },
      },
      async ({ params, query, set }) => {
        await service.delete(params.projectId, { purge: query.purge })
        set.status = 204
      },
    )
    .post(
      '/projects/:projectId/jwts',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          scopes: t.Array(t.String(), { maxItems: 100 }),
          duration: t.Integer({ minimum: 0, maximum: 3600 }),
        }),
        response: t.Object({ jwt: t.String() }),
        detail: { summary: 'Create project JWT', tags: ['projects'] },
      },
      ({ params, body }) => service.createJwt(params.projectId, body),
    )
    .patch(
      '/projects/:projectId/service',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          service: t.String(),
          status: t.Boolean(),
        }),
        response: ProjectSchema,
        detail: { summary: 'Update service status', tags: ['projects'] },
      },
      ({ params, body }) => service.updateServiceStatus(params.projectId, body),
    )
    .patch(
      '/projects/:projectId/service/all',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          status: t.Boolean(),
        }),
        response: ProjectSchema,
        detail: { summary: 'Update all service status', tags: ['projects'] },
      },
      ({ params, body }) => service.updateAllServiceStatus(params.projectId, body.status),
    )
    .patch(
      '/projects/:projectId/api',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          api: t.String(),
          status: t.Boolean(),
        }),
        response: ProjectSchema,
        detail: { summary: 'Update API status', tags: ['projects'] },
      },
      ({ params, body }) => service.updateApiStatus(params.projectId, body),
    )
    .patch(
      '/projects/:projectId/api/all',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          status: t.Boolean(),
        }),
        response: ProjectSchema,
        detail: { summary: 'Update all API status', tags: ['projects'] },
      },
      ({ params, body }) => service.updateAllApiStatus(params.projectId, body.status),
    )
    .patch(
      '/projects/:projectId/oauth2',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          provider: t.String(),
          appId: t.Optional(t.String({ maxLength: 256 })),
          secret: t.Optional(t.String({ maxLength: 512 })),
          enabled: t.Optional(t.Boolean()),
        }),
        response: ProjectSchema,
        detail: { summary: 'Update project OAuth2', tags: ['projects'] },
      },
      ({ params, body }) => service.updateOAuth2(params.projectId, body),
    )
    .patch(
      '/projects/:projectId/smtp',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          enabled: t.Boolean(),
          senderName: t.Optional(t.String({ maxLength: 255 })),
          senderEmail: t.Optional(t.String({ maxLength: 255 })),
          replyTo: t.Optional(t.String({ maxLength: 255 })),
          host: t.Optional(t.String({ maxLength: 255 })),
          port: t.Optional(t.Integer({ minimum: 1, maximum: 65535 })),
          username: t.Optional(t.String({ maxLength: 255 })),
          password: t.Optional(t.String({ maxLength: 255 })),
          secure: t.Optional(t.Union([t.Literal('tls'), t.Literal('ssl'), t.Boolean()])),
        }),
        response: ProjectSchema,
        detail: { summary: 'Update SMTP', tags: ['projects'] },
      },
      ({ params, body }) => service.updateSMTP(params.projectId, body),
    )
    .post(
      '/projects/:projectId/smtp/tests',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          emails: t.Array(t.String(), { maxItems: 10 }),
          senderName: t.String({ maxLength: 255 }),
        }),
        response: t.Void(),
        detail: { summary: 'Create SMTP test', tags: ['projects'] },
      },
      ({ params }) => service.testSMTP(params.projectId),
    )
}
