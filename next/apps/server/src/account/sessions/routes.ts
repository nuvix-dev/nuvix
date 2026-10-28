/** Defines authenticated session inspection, revocation, creation, and token-exchange endpoints. */
import type { Doc, Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { auditAfter } from '../../plugins/audit'
import type { Sessions, Users } from '../../types/generated'
import { requestIp, requestUserAgent } from '../../utils/request'
import { requireAuth } from '../auth'
import type { OAuth2RouteDeps } from '../oauth2/routes'
import { createOAuth2Refresher } from '../oauth2/service'
import { AccountSessionsService } from './service'

/** Compose session routes with optional JWT and OAuth2 refresh capabilities. */
export const accountSessionsRoutes = (
  options: { jwtSecret?: string; oauth2?: OAuth2RouteDeps } = {},
) =>
  new Elysia()
    // Session ownership and project context come from the request pipeline.
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
      session: ('session' in ctx ? ctx.session : undefined) as unknown as Doc<Sessions>,
      project: ('project' in ctx ? ctx.project : undefined) as unknown as {
        id: string
      },
    }))

    // Session inspection and revocation.
    .get(
      '/sessions',
      {
        detail: {
          summary: 'List sessions',
          description: 'Retrieve all active sessions for the currently authenticated user.',
          tags: ['Account Sessions'],
        },
      },
      async ({ db, user, session }) => {
        const userId = requireAuth(user)
        const service = new AccountSessionsService(db, options.jwtSecret)
        return service.getSessions(userId, session?.getId())
      },
    )

    .delete(
      '/sessions',
      {
        detail: {
          summary: 'Delete all sessions',
          description: 'Log out the user from all active devices and revoke all sessions.',
          tags: ['Account Sessions'],
        },
        response: {
          200: t.Object({
            status: t.Literal('ok', {
              description: 'Operation status confirmation',
            }),
          }),
        },
        afterHandle: auditAfter({
          event: 'sessions.delete',
          resource: 'user/{user.$id}',
          userId: '{user.$id}',
        }),
      },
      async ({ db, user }) => {
        const userId = requireAuth(user)
        const service = new AccountSessionsService(db, options.jwtSecret)
        await service.deleteSessions(userId)
        return { status: 'ok' as const }
      },
    )

    .get(
      '/sessions/:sessionId',
      {
        detail: {
          summary: 'Get session by ID',
          description:
            'Retrieve details of a specific session belonging to the authenticated user.',
          tags: ['Account Sessions'],
        },
        params: t.Object({
          sessionId: t.String({ description: 'Unique session identifier' }),
        }),
      },
      async ({ db, user, session, params: { sessionId } }) => {
        const userId = requireAuth(user)
        const service = new AccountSessionsService(db, options.jwtSecret)
        return service.getSession(userId, sessionId, session?.getId())
      },
    )

    .delete(
      '/sessions/:sessionId',
      {
        detail: {
          summary: 'Delete session by ID',
          description: 'Revoke and delete a specific session.',
          tags: ['Account Sessions'],
        },
        params: t.Object({
          sessionId: t.String({
            description: 'Unique session identifier to revoke',
          }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', {
              description: 'Operation status confirmation',
            }),
          }),
        },
        afterHandle: auditAfter({
          event: 'session.delete',
          resource: 'user/{user.$id}',
          userId: '{user.$id}',
        }),
      },
      async ({ db, user, session, params: { sessionId } }) => {
        const userId = requireAuth(user)
        const service = new AccountSessionsService(db, options.jwtSecret)
        await service.deleteSession(userId, sessionId, session?.getId())
        return { status: 'ok' as const }
      },
    )

    .patch(
      '/sessions/:sessionId',
      {
        detail: {
          summary: 'Extend session',
          description: 'Extend the expiration time of an existing active session.',
          tags: ['Account Sessions'],
        },
        params: t.Object({
          sessionId: t.String({ description: 'Unique session identifier' }),
        }),
        afterHandle: auditAfter({
          event: 'session.update',
          resource: 'user/{res.userId}',
          userId: '{res.userId}',
        }),
      },
      async ({ db, user, session, params: { sessionId }, project }) => {
        const userId = requireAuth(user)
        const service = new AccountSessionsService(db, options.jwtSecret, {
          // Provider refresh is available only when OAuth2 composition supplies its registry.
          refreshOAuth2: options.oauth2
            ? createOAuth2Refresher({
                registry: options.oauth2.registry,
                encryptionKey: options.oauth2.encryptionKey,
                projectId: project.id,
                db,
              })
            : undefined,
        })
        return service.updateSession(userId, sessionId, session?.getId())
      },
    )

    // Session creation and one-time token exchanges.
    .post(
      '/sessions/email',
      {
        detail: {
          summary: 'Create email session',
          description: 'Authenticate with email and password to create a new session.',
          tags: ['Account Sessions'],
        },
        body: t.Object({
          email: t.String({
            format: 'email',
            description: 'User account email address',
          }),
          password: t.String({ description: 'User account password' }),
        }),
        afterHandle: auditAfter({
          event: 'session.create',
          resource: 'user/{res.userId}',
          userId: '{res.userId}',
        }),
      },
      async ({ db, body, request, server }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createEmailSession(body, {
          ip: requestIp(request, server),
          userAgent: requestUserAgent(request),
        })
        return res.session
      },
    )
    .post(
      '/sessions',
      {
        detail: {
          summary: 'Create email session (alias)',
          description: 'Authenticate with email and password (alias of /sessions/email).',
          tags: ['Account Sessions'],
        },
        body: t.Object({
          email: t.String({
            format: 'email',
            description: 'User account email address',
          }),
          password: t.String({ description: 'User account password' }),
        }),
        afterHandle: auditAfter({
          event: 'session.create',
          resource: 'user/{res.userId}',
          userId: '{res.userId}',
        }),
      },
      async ({ db, body, request, server }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createEmailSession(body, {
          ip: requestIp(request, server),
          userAgent: requestUserAgent(request),
        })
        return res.session
      },
    )

    .post(
      '/sessions/anonymous',
      {
        detail: {
          summary: 'Create anonymous session',
          description: 'Create an anonymous guest user account and authenticated session.',
          tags: ['Account Sessions'],
        },
        afterHandle: auditAfter({
          event: 'session.create',
          resource: 'user/{res.userId}',
          userId: '{res.userId}',
        }),
      },
      async ({ db, request, server }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createAnonymousSession({
          ip: requestIp(request, server),
          userAgent: requestUserAgent(request),
        })
        return res.session
      },
    )

    .post(
      '/sessions/token',
      {
        detail: {
          summary: 'Create session with token',
          description: 'Exchange a valid one-time login secret token for a persistent session.',
          tags: ['Account Sessions'],
        },
        body: t.Object({
          userId: t.String({
            description: 'User ID associated with the token',
          }),
          secret: t.String({ description: 'One-time login secret token' }),
        }),
        afterHandle: auditAfter({
          event: 'session.create',
          resource: 'user/{res.userId}',
          userId: '{res.userId}',
        }),
      },
      async ({ db, body, request, server }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createSessionWithToken(body, {
          ip: requestIp(request, server),
          userAgent: requestUserAgent(request),
        })
        return res.session
      },
    )

    .put(
      '/sessions/magic-url',
      {
        detail: {
          summary: 'Complete magic URL login',
          description: 'Complete magic URL authentication using secret token.',
          tags: ['Account Sessions'],
        },
        body: t.Object({
          userId: t.String({
            description: 'User ID associated with magic URL token',
          }),
          secret: t.String({ description: 'Secret token from magic URL link' }),
        }),
        afterHandle: auditAfter({
          event: 'session.create',
          resource: 'user/{res.userId}',
          userId: '{res.userId}',
        }),
      },
      async ({ db, body, request, server }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createSessionWithToken(body, {
          ip: requestIp(request, server),
          userAgent: requestUserAgent(request),
        })
        return res.session
      },
    )

    .put(
      '/sessions/phone',
      {
        detail: {
          summary: 'Complete phone SMS session',
          description: 'Complete phone authentication using SMS OTP code.',
          tags: ['Account Sessions'],
        },
        body: t.Object({
          userId: t.String({
            description: 'User ID associated with phone OTP',
          }),
          secret: t.String({ description: 'SMS OTP verification code' }),
        }),
        afterHandle: auditAfter({
          event: 'session.create',
          resource: 'user/{res.userId}',
          userId: '{res.userId}',
        }),
      },
      async ({ db, body, request, server }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createSessionWithToken(body, {
          ip: requestIp(request, server),
          userAgent: requestUserAgent(request),
        })
        return res.session
      },
    )

    .post(
      '/sessions/phone',
      {
        detail: {
          summary: 'Initiate phone login',
          description: 'Send SMS OTP token to a phone number to begin phone login.',
          tags: ['Account Sessions'],
        },
        body: t.Object({
          userId: t.Optional(t.String({ description: 'User ID if known' })),
          phone: t.String({ description: 'User phone number in E.164 format' }),
        }),
        afterHandle: auditAfter({
          event: 'session.create',
          resource: 'user/{res.userId}',
          userId: '{res.userId}',
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        return service.createPhoneToken(body)
      },
    )
