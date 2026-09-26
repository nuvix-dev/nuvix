import type { Doc, Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { Sessions, Users } from '../../types/generated'
import { requireAuth } from '../auth'
import { AccountSessionsService } from '../sessions/service'

export const accountTokensRoutes = (options: { jwtSecret?: string } = {}) =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
      session: ('session' in ctx ? ctx.session : undefined) as unknown as Doc<Sessions>,
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
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        return service.createMagicURLToken(body)
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
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        return service.createEmailToken(body)
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
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
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
        const service = new AccountSessionsService(db, options.jwtSecret)
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
        const service = new AccountSessionsService(db, options.jwtSecret)
        return service.createJWT(userId, session?.getId())
      },
    )
