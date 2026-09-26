import type { Doc, Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { Sessions, Users } from '../../types/generated'
import { requireAuth } from '../auth'
import { AccountSessionsService } from './service'

export const accountSessionsRoutes = (options: { jwtSecret?: string } = {}) =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
      session: ('session' in ctx ? ctx.session : undefined) as unknown as Doc<Sessions>,
    }))

    // 17. List sessions
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

    // 18. Delete all sessions
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
            status: t.Literal('ok', { description: 'Operation status confirmation' }),
          }),
        },
      },
      async ({ db, user }) => {
        const userId = requireAuth(user)
        const service = new AccountSessionsService(db, options.jwtSecret)
        await service.deleteSessions(userId)
        return { status: 'ok' as const }
      },
    )

    // 19. Get session
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

    // 20. Delete session
    .delete(
      '/sessions/:sessionId',
      {
        detail: {
          summary: 'Delete session by ID',
          description: 'Revoke and delete a specific session.',
          tags: ['Account Sessions'],
        },
        params: t.Object({
          sessionId: t.String({ description: 'Unique session identifier to revoke' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Operation status confirmation' }),
          }),
        },
      },
      async ({ db, user, session, params: { sessionId } }) => {
        const userId = requireAuth(user)
        const service = new AccountSessionsService(db, options.jwtSecret)
        await service.deleteSession(userId, sessionId, session?.getId())
        return { status: 'ok' as const }
      },
    )

    // 21. Update session (extend)
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
      },
      async ({ db, user, session, params: { sessionId } }) => {
        const userId = requireAuth(user)
        const service = new AccountSessionsService(db, options.jwtSecret)
        return service.updateSession(userId, sessionId, session?.getId())
      },
    )

    // 22. Create email session (and alias /sessions)
    .post(
      '/sessions/email',
      {
        detail: {
          summary: 'Create email session',
          description: 'Authenticate with email and password to create a new session.',
          tags: ['Account Sessions'],
        },
        body: t.Object({
          email: t.String({ format: 'email', description: 'User account email address' }),
          password: t.String({ description: 'User account password' }),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createEmailSession(body)
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
          email: t.String({ format: 'email', description: 'User account email address' }),
          password: t.String({ description: 'User account password' }),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createEmailSession(body)
        return res.session
      },
    )

    // 23. Create anonymous session
    .post(
      '/sessions/anonymous',
      {
        detail: {
          summary: 'Create anonymous session',
          description: 'Create an anonymous guest user account and authenticated session.',
          tags: ['Account Sessions'],
        },
      },
      async ({ db }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createAnonymousSession({})
        return res.session
      },
    )

    // 24. Create session with token
    .post(
      '/sessions/token',
      {
        detail: {
          summary: 'Create session with token',
          description: 'Exchange a valid one-time login secret token for a persistent session.',
          tags: ['Account Sessions'],
        },
        body: t.Object({
          userId: t.String({ description: 'User ID associated with the token' }),
          secret: t.String({ description: 'One-time login secret token' }),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createSessionWithToken(body)
        return res.session
      },
    )

    // 25. Update magic URL session
    .put(
      '/sessions/magic-url',
      {
        detail: {
          summary: 'Complete magic URL login',
          description: 'Complete magic URL authentication using secret token.',
          tags: ['Account Sessions'],
        },
        body: t.Object({
          userId: t.String({ description: 'User ID associated with magic URL token' }),
          secret: t.String({ description: 'Secret token from magic URL link' }),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createSessionWithToken(body)
        return res.session
      },
    )

    // 26. Update phone session
    .put(
      '/sessions/phone',
      {
        detail: {
          summary: 'Complete phone SMS session',
          description: 'Complete phone authentication using SMS OTP code.',
          tags: ['Account Sessions'],
        },
        body: t.Object({
          userId: t.String({ description: 'User ID associated with phone OTP' }),
          secret: t.String({ description: 'SMS OTP verification code' }),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createSessionWithToken(body)
        return res.session
      },
    )

    // 27. Create phone token (and alias /sessions/phone)
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
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        return service.createPhoneToken(body)
      },
    )
