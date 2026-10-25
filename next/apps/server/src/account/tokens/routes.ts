import type { Doc, Session } from '@nuvix/db'
import type { Translator } from '@nuvix/i18n'
import { Elysia, t } from 'elysia'
import type { MailComposer, MailDelivery } from '../../mail/composer'
import { auditAfter } from '../../plugins/audit'
import type { Sessions, Users } from '../../types/generated'
import { requireAuth } from '../auth'
import { AccountSessionsService } from '../sessions/service'

export interface TokensRouteDeps {
  /** System-email composer (undefined in test composition → no email). */
  mail?: MailComposer
}

export const accountTokensRoutes = ({
  jwtSecret,
  mail,
}: { jwtSecret?: string } & TokensRouteDeps = {}) =>
  new Elysia({ name: 'account-tokens' })
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
      session: ('session' in ctx ? ctx.session : undefined) as unknown as Doc<Sessions>,
      project: ('project' in ctx ? ctx.project : undefined) as unknown as
        | { id: string }
        | undefined,
      locale: ('locale' in ctx ? ctx.locale : undefined) as unknown as Translator | undefined,
    }))

    // 28. Create magic URL token
    .post(
      '/tokens/magic-url',
      {
        detail: {
          summary: 'Create magic URL token',
          description: 'Generate and email a passwordless magic URL login token.',
          tags: ['Account Tokens'],
        },
        body: t.Object({
          userId: t.Optional(t.String({ description: 'User ID if pre-determined' })),
          email: t.String({ format: 'email', description: 'Destination user email address' }),
          url: t.Optional(
            t.String({ format: 'uri', description: 'Redirect URL callback containing token' }),
          ),
          phrase: t.Optional(
            t.Boolean({
              description:
                'Toggle for security phrase. If enabled, the email includes a randomly generated phrase which is also returned in the response (v1 parity).',
              default: false,
            }),
          ),
        }),
        afterHandle: auditAfter({ event: 'session.create', resource: 'user/{res.userId}' }),
      },
      async ({ db, body, locale, project, request }) => {
        const service = new AccountSessionsService(db, jwtSecret)
        return service.createMagicURLToken(
          body,
          await mailDelivery(mail, project?.id, locale, request),
        )
      },
    )

    // 29. Create email token (OTP)
    .post(
      '/tokens/email',
      {
        detail: {
          summary: 'Create email OTP token',
          description: 'Send a numeric OTP code via email for passwordless verification.',
          tags: ['Account Tokens'],
        },
        body: t.Object({
          userId: t.Optional(t.String({ description: 'User ID if pre-determined' })),
          email: t.String({ format: 'email', description: 'Destination user email address' }),
        }),
        afterHandle: auditAfter({ event: 'session.create', resource: 'user/{res.userId}' }),
      },
      async ({ db, body, locale, project, request }) => {
        const service = new AccountSessionsService(db, jwtSecret)
        return service.createEmailToken(
          body,
          await mailDelivery(mail, project?.id, locale, request),
        )
      },
    )

    // 30. Create phone token
    .post(
      '/tokens/phone',
      {
        detail: {
          summary: 'Create phone SMS token',
          description: 'Send an SMS verification OTP to a destination phone number.',
          tags: ['Account Tokens'],
        },
        body: t.Object({
          userId: t.Optional(t.String({ description: 'User ID if pre-determined' })),
          phone: t.String({ description: 'Phone number in E.164 format' }),
        }),
        afterHandle: auditAfter({ event: 'session.create', resource: 'user/{res.userId}' }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, jwtSecret)
        return service.createPhoneToken(body)
      },
    )

    // 31. Create JWT (and alias /jwt)
    .post(
      '/jwts',
      {
        detail: {
          summary: 'Create JWT access token',
          description:
            'Issue a signed short-lived JSON Web Token for the authenticated user and session.',
          tags: ['Account Tokens'],
        },
      },
      async ({ db, user, session }) => {
        const userId = requireAuth(user)
        const service = new AccountSessionsService(db, jwtSecret)
        return service.createJWT(userId, session?.getId())
      },
    )
    .post(
      '/jwt',
      {
        detail: {
          summary: 'Create JWT access token (alias)',
          description: 'Alias for POST /account/jwts.',
          tags: ['Account Tokens'],
        },
      },
      async ({ db, user, session }) => {
        const userId = requireAuth(user)
        const service = new AccountSessionsService(db, jwtSecret)
        return service.createJWT(userId, session?.getId())
      },
    )

/**
 * Per-request delivery bundle; `undefined` when no composer/locale is
 * wired (the service then skips the mail path — test mode).
 */
async function mailDelivery(
  composer: MailComposer | undefined,
  projectId: string | undefined,
  locale: Translator | undefined,
  request: Request,
): Promise<(MailDelivery & { origin: string }) | undefined> {
  if (!composer || !projectId || !locale) return undefined
  return {
    mail: composer.capabilityFor(projectId),
    locale,
    rules: await composer.redirectRulesFor(projectId),
    origin: new URL(request.url).origin,
  }
}
