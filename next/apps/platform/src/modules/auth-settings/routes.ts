import { Elysia, t } from 'elysia'
import type { AuthSettingsService } from './service'

export function authSettingsRoutes(service: AuthSettingsService) {
  return new Elysia({ name: 'auth-settings-routes' })
    .get(
      '/projects/:projectId/auth',
      {
        params: t.Object({ projectId: t.String() }),
        detail: { summary: 'Get project auth settings', tags: ['auth-settings'] },
      },
      ({ params: { projectId } }) => service.getAuthSettings(projectId),
    )
    .patch(
      '/projects/:projectId/auth/session-alerts',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({ alerts: t.Boolean() }),
        detail: { summary: 'Update session alerts', tags: ['auth-settings'] },
      },
      ({ params: { projectId }, body }) => service.updateSessionAlerts(projectId, body.alerts),
    )
    .patch(
      '/projects/:projectId/auth/limit',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({ limit: t.Number({ minimum: 0 }) }),
        detail: { summary: 'Update auth users limit', tags: ['auth-settings'] },
      },
      ({ params: { projectId }, body }) => service.updateAuthLimit(projectId, body.limit),
    )
    .patch(
      '/projects/:projectId/auth/duration',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({ duration: t.Number({ minimum: 0 }) }),
        detail: { summary: 'Update session duration', tags: ['auth-settings'] },
      },
      ({ params: { projectId }, body }) => service.updateSessionDuration(projectId, body.duration),
    )
    .patch(
      '/projects/:projectId/auth/password-history',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({ limit: t.Number({ minimum: 0, maximum: 20 }) }),
        detail: { summary: 'Update password history limit', tags: ['auth-settings'] },
      },
      ({ params: { projectId }, body }) => service.updatePasswordHistory(projectId, body.limit),
    )
    .patch(
      '/projects/:projectId/auth/password-dictionary',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({ enabled: t.Boolean() }),
        detail: { summary: 'Update password dictionary check', tags: ['auth-settings'] },
      },
      ({ params: { projectId }, body }) =>
        service.updatePasswordDictionary(projectId, body.enabled),
    )
    .patch(
      '/projects/:projectId/auth/personal-data',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({ enabled: t.Boolean() }),
        detail: { summary: 'Update personal data check', tags: ['auth-settings'] },
      },
      ({ params: { projectId }, body }) => service.updatePersonalData(projectId, body.enabled),
    )
    .patch(
      '/projects/:projectId/auth/max-sessions',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({ limit: t.Number({ minimum: 1, maximum: 100 }) }),
        detail: { summary: 'Update max sessions limit', tags: ['auth-settings'] },
      },
      ({ params: { projectId }, body }) => service.updateMaxSessions(projectId, body.limit),
    )
    .patch(
      '/projects/:projectId/auth/mock-numbers',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          numbers: t.Array(
            t.Object({
              phone: t.String(),
              otp: t.String(),
            }),
          ),
        }),
        detail: { summary: 'Update mock numbers', tags: ['auth-settings'] },
      },
      ({ params: { projectId }, body }) => service.updateMockNumbers(projectId, body.numbers),
    )
    .patch(
      '/projects/:projectId/auth/memberships-privacy',
      {
        params: t.Object({ projectId: t.String() }),
        body: t.Object({
          userName: t.Optional(t.Boolean()),
          userEmail: t.Optional(t.Boolean()),
          mfa: t.Optional(t.Boolean()),
        }),
        detail: { summary: 'Update memberships privacy', tags: ['auth-settings'] },
      },
      ({ params: { projectId }, body }) => service.updateMembershipsPrivacy(projectId, body),
    )
    .patch(
      '/projects/:projectId/auth/methods/:method',
      {
        params: t.Object({ projectId: t.String(), method: t.String() }),
        body: t.Object({ status: t.Boolean() }),
        detail: { summary: 'Update auth method status', tags: ['auth-settings'] },
      },
      ({ params: { projectId, method }, body }) =>
        service.updateAuthMethod(projectId, method, body.status),
    )
}
