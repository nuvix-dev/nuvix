/** Defines the project-scoped webhook lifecycle, including delivery settings and signature rotation. */

import { Elysia, t } from 'elysia'
import type { WebhooksService } from './service'

// Reuse one response schema so create, read, update, and rotation stay shape-compatible.
const WebhookSchema = t.Object({
  $id: t.String(),
  projectId: t.String(),
  name: t.String(),
  url: t.String(),
  events: t.Array(t.String()),
  security: t.Boolean(),
  httpUser: t.Nullable(t.String()),
  enabled: t.Boolean(),
  signatureKey: t.Nullable(t.String()),
  logs: t.String(),
  attempts: t.Number(),
  $createdAt: t.Any(),
  $updatedAt: t.Any(),
})

/** Adds transport validation while the service enforces project ownership and webhook persistence. */
export function webhookRoutes(service: WebhooksService) {
  return new Elysia({ name: 'webhook-routes' })
    .post(
      '/projects/:projectId/webhooks',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 128 }),
          url: t.String({ minLength: 1 }),
          events: t.Array(t.String()),
          security: t.Optional(t.Boolean()),
          httpUser: t.Optional(t.String()),
          httpPass: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          signatureKey: t.Optional(t.String()),
        }),
        response: WebhookSchema,
        detail: { summary: 'Create a webhook', tags: ['webhooks'] },
      },
      ({ params: { projectId }, body }) => service.create(projectId, body),
    )
    .get(
      '/projects/:projectId/webhooks',
      {
        params: t.Object({ projectId: t.String() }),
        query: t.Object({
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
          offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
        }),
        response: t.Object({
          data: t.Array(WebhookSchema),
          meta: t.Object({
            total: t.Number(),
            limit: t.Number(),
            offset: t.Number(),
          }),
        }),
        detail: { summary: 'List webhooks', tags: ['webhooks'] },
      },
      async ({ params: { projectId }, query }) => {
        // Resolve optional pagination values to the public contract defaults.
        const limit = query.limit ?? 25
        const offset = query.offset ?? 0
        const { webhooks, total } = await service.list(projectId, limit, offset)
        return { data: webhooks, meta: { total, limit, offset } }
      },
    )
    .get(
      '/projects/:projectId/webhooks/:webhookId',
      {
        params: t.Object({ projectId: t.String(), webhookId: t.String() }),
        response: WebhookSchema,
        detail: { summary: 'Get a webhook', tags: ['webhooks'] },
      },
      ({ params: { projectId, webhookId } }) => service.get(projectId, webhookId),
    )
    .put(
      '/projects/:projectId/webhooks/:webhookId',
      {
        params: t.Object({ projectId: t.String(), webhookId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          url: t.Optional(t.String()),
          events: t.Optional(t.Array(t.String())),
          security: t.Optional(t.Boolean()),
          httpUser: t.Optional(t.String()),
          httpPass: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
        }),
        response: WebhookSchema,
        detail: { summary: 'Update a webhook', tags: ['webhooks'] },
      },
      ({ params: { projectId, webhookId }, body }) => service.update(projectId, webhookId, body),
    )
    .patch(
      '/projects/:projectId/webhooks/:webhookId',
      {
        params: t.Object({ projectId: t.String(), webhookId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          url: t.Optional(t.String()),
          events: t.Optional(t.Array(t.String())),
          security: t.Optional(t.Boolean()),
          httpUser: t.Optional(t.String()),
          httpPass: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
        }),
        response: WebhookSchema,
        detail: { summary: 'Update a webhook', tags: ['webhooks'] },
      },
      ({ params: { projectId, webhookId }, body }) => service.update(projectId, webhookId, body),
    )
    .patch(
      '/projects/:projectId/webhooks/:webhookId/signature',
      {
        params: t.Object({ projectId: t.String(), webhookId: t.String() }),
        response: WebhookSchema,
        detail: { summary: 'Update webhook signature key', tags: ['webhooks'] },
      },
      ({ params: { projectId, webhookId } }) => service.updateSignature(projectId, webhookId),
    )
    .delete(
      '/projects/:projectId/webhooks/:webhookId',
      {
        params: t.Object({ projectId: t.String(), webhookId: t.String() }),
        response: t.Object({ status: t.Literal('ok') }),
        detail: { summary: 'Delete a webhook', tags: ['webhooks'] },
      },
      async ({ params: { projectId, webhookId } }) => {
        await service.delete(projectId, webhookId)
        return { status: 'ok' as const }
      },
    )
}
