import { Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { UserSessionsService } from './service'

export const userSessionsRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))

    // 1. List user sessions
    .get(
      '/:userId/sessions',
      {
        detail: {
          summary: 'List user sessions',
          description: 'Retrieve a list of all active sessions belonging to the specified user.',
          tags: ['Users Sessions'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        query: t.Object({
          limit: t.Optional(
            t.String({
              description: 'Maximum number of sessions to return',
              pattern: '^[0-9]+$',
            }),
          ),
          offset: t.Optional(
            t.String({
              description: 'Number of sessions to skip before returning results',
              pattern: '^[0-9]+$',
            }),
          ),
        }),
      },
      async ({ db, params: { userId }, query }) => {
        const service = new UserSessionsService(db)
        const queries: Query[] = []
        if (query.limit) queries.push(Query.limit(Number(query.limit)))
        if (query.offset) queries.push(Query.offset(Number(query.offset)))
        return service.findAll(userId, queries)
      },
    )

    // 2. Create user session
    .post(
      '/:userId/sessions',
      {
        detail: {
          summary: 'Create user session',
          description: 'Create a new administrative session for the specified user.',
          tags: ['Users Sessions'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          provider: t.Optional(
            t.String({
              description: 'Authentication provider name (e.g. email, magic-url)',
              default: 'email',
            }),
          ),
          expireInSeconds: t.Optional(
            t.Number({
              description: 'Session duration in seconds before expiration',
              default: 31536000,
            }),
          ),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UserSessionsService(db)
        return service.create(userId, body)
      },
    )

    // 3. Delete all user sessions
    .delete(
      '/:userId/sessions',
      {
        detail: {
          summary: 'Delete all user sessions',
          description: 'Revoke and delete all active sessions for the specified user.',
          tags: ['Users Sessions'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('success', { description: 'Status confirmation string' }),
          }),
        },
      },
      async ({ db, params: { userId } }) => {
        const service = new UserSessionsService(db)
        return service.deleteAll(userId)
      },
    )

    // 4. Delete user session by ID
    .delete(
      '/:userId/sessions/:sessionId',
      {
        detail: {
          summary: 'Delete user session by ID',
          description: 'Revoke and delete a specific active session for the user.',
          tags: ['Users Sessions'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
          sessionId: t.String({ description: 'Unique session identifier to revoke' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('success', { description: 'Status confirmation string' }),
          }),
        },
      },
      async ({ db, params: { userId, sessionId } }) => {
        const service = new UserSessionsService(db)
        return service.delete(userId, sessionId)
      },
    )
