import { Elysia, t } from 'elysia'
import type { TemplatesService } from './service'

export function templatesRoutes(service: TemplatesService) {
  return new Elysia({ name: 'templates-routes' })
    .get(
      '/projects/:projectId/templates/sms/:type/:locale',
      {
        params: t.Object({
          projectId: t.String(),
          type: t.String(),
          locale: t.String(),
        }),
        detail: { summary: 'Get custom SMS template', tags: ['templates'] },
      },
      ({ params: { projectId, type, locale } }) => service.getSmsTemplate(projectId, type, locale),
    )
    .patch(
      '/projects/:projectId/templates/sms/:type/:locale',
      {
        params: t.Object({
          projectId: t.String(),
          type: t.String(),
          locale: t.String(),
        }),
        body: t.Optional(t.Record(t.String(), t.Any())),
        detail: { summary: 'Update custom SMS template', tags: ['templates'] },
      },
      ({ params: { projectId, type, locale }, body }) =>
        service.updateSmsTemplate(projectId, type, locale, body),
    )
    .delete(
      '/projects/:projectId/templates/sms/:type/:locale',
      {
        params: t.Object({
          projectId: t.String(),
          type: t.String(),
          locale: t.String(),
        }),
        response: t.Void(),
        detail: { summary: 'Reset custom SMS template', tags: ['templates'] },
      },
      async ({ params: { projectId, type, locale }, set }) => {
        await service.deleteSmsTemplate(projectId, type, locale)
        set.status = 204
      },
    )
    .get(
      '/projects/:projectId/templates/email/:type/:locale',
      {
        params: t.Object({
          projectId: t.String(),
          type: t.String(),
          locale: t.String(),
        }),
        detail: { summary: 'Get custom email template', tags: ['templates'] },
      },
      ({ params: { projectId, type, locale } }) =>
        service.getEmailTemplate(projectId, type, locale),
    )
    .patch(
      '/projects/:projectId/templates/email/:type/:locale',
      {
        params: t.Object({
          projectId: t.String(),
          type: t.String(),
          locale: t.String(),
        }),
        body: t.Optional(t.Record(t.String(), t.Any())),
        detail: {
          summary: 'Update custom email templates',
          tags: ['templates'],
        },
      },
      ({ params: { projectId, type, locale }, body }) =>
        service.updateEmailTemplate(projectId, type, locale, body),
    )
    .delete(
      '/projects/:projectId/templates/email/:type/:locale',
      {
        params: t.Object({
          projectId: t.String(),
          type: t.String(),
          locale: t.String(),
        }),
        response: t.Void(),
        detail: {
          summary: 'Delete custom email template',
          tags: ['templates'],
        },
      },
      async ({ params: { projectId, type, locale }, set }) => {
        await service.deleteEmailTemplate(projectId, type, locale)
        set.status = 204
      },
    )
}
