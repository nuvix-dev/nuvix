import { Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { UsersService } from './service'
import { UserSessionsService } from './sessions.service'
import { UserTargetsService } from './targets.service'

export const userRoutes = (options: { jwtSecret?: string } = {}) =>
  new Elysia({ prefix: '/users' })
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))
    // 1. List users
    .get(
      '',
      {
        query: t.Object({
          search: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
          cursor: t.Optional(t.String()),
        }),
      },
      async ({ db, query }) => {
        const service = new UsersService(db, options.jwtSecret)
        const queries: Query[] = []
        if (query.limit) queries.push(Query.limit(Number(query.limit)))
        if (query.offset) queries.push(Query.offset(Number(query.offset)))
        if (query.cursor) queries.push(Query.cursorAfter(query.cursor))
        return service.findAll(queries, query.search)
      },
    )

    // 2. Create user (default argon2id)
    .post(
      '',
      {
        body: t.Object({
          userId: t.Optional(t.String()),
          email: t.Optional(t.String()),
          phone: t.Optional(t.String()),
          password: t.Optional(t.String()),
          name: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.create(body)
      },
    )

    // 3. Create user with Argon2
    .post(
      '/argon2',
      {
        body: t.Object({
          userId: t.Optional(t.String()),
          email: t.Optional(t.String()),
          phone: t.Optional(t.String()),
          password: t.Optional(t.String()),
          name: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.createArgon2(body)
      },
    )

    // 4. Create user with Bcrypt
    .post(
      '/bcrypt',
      {
        body: t.Object({
          userId: t.Optional(t.String()),
          email: t.Optional(t.String()),
          phone: t.Optional(t.String()),
          password: t.Optional(t.String()),
          name: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.createBcrypt(body)
      },
    )

    // 5. Get user
    .get(
      '/:userId',
      {
        params: t.Object({
          userId: t.String(),
        }),
      },
      async ({ db, params: { userId } }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.findOne(userId)
      },
    )

    // 6. Delete user
    .delete(
      '/:userId',
      {
        params: t.Object({
          userId: t.String(),
        }),
      },
      async ({ db, params: { userId } }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.delete(userId)
      },
    )

    // 7. Update status
    .patch(
      '/:userId/status',
      {
        params: t.Object({
          userId: t.String(),
        }),
        body: t.Object({
          status: t.Boolean(),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updateStatus(userId, body.status)
      },
    )

    // 8. Update name
    .patch(
      '/:userId/name',
      {
        params: t.Object({
          userId: t.String(),
        }),
        body: t.Object({
          name: t.String(),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updateName(userId, body.name)
      },
    )

    // 9. Update email
    .patch(
      '/:userId/email',
      {
        params: t.Object({
          userId: t.String(),
        }),
        body: t.Object({
          email: t.String(),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updateEmail(userId, body.email)
      },
    )

    // 10. Update phone
    .patch(
      '/:userId/phone',
      {
        params: t.Object({
          userId: t.String(),
        }),
        body: t.Object({
          phone: t.String(),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updatePhone(userId, body.phone)
      },
    )

    // 11. Update password
    .patch(
      '/:userId/password',
      {
        params: t.Object({
          userId: t.String(),
        }),
        body: t.Object({
          password: t.String(),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updatePassword(userId, body.password)
      },
    )

    // 12. Update labels
    .put(
      '/:userId/labels',
      {
        params: t.Object({
          userId: t.String(),
        }),
        body: t.Object({
          labels: t.Array(t.String()),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updateLabels(userId, body.labels)
      },
    )

    // 13. Update email verification
    .patch(
      '/:userId/verification',
      {
        params: t.Object({
          userId: t.String(),
        }),
        body: t.Object({
          emailVerification: t.Boolean(),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updateEmailVerification(userId, body.emailVerification)
      },
    )

    // 14. Update phone verification
    .patch(
      '/:userId/verification/phone',
      {
        params: t.Object({
          userId: t.String(),
        }),
        body: t.Object({
          phoneVerification: t.Boolean(),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updatePhoneVerification(userId, body.phoneVerification)
      },
    )

    // 15. Get prefs
    .get(
      '/:userId/prefs',
      {
        params: t.Object({
          userId: t.String(),
        }),
      },
      async ({ db, params: { userId } }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.getPrefs(userId)
      },
    )

    // 16. Update prefs
    .patch(
      '/:userId/prefs',
      {
        params: t.Object({
          userId: t.String(),
        }),
        body: t.Object({
          prefs: t.Record(t.String(), t.Any()),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updatePrefs(userId, body.prefs)
      },
    )

    // 17. User Sessions
    .get(
      '/:userId/sessions',
      {
        params: t.Object({ userId: t.String() }),
        query: t.Object({
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
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
    .post(
      '/:userId/sessions',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({
          provider: t.Optional(t.String()),
          expireInSeconds: t.Optional(t.Number()),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UserSessionsService(db)
        return service.create(userId, body)
      },
    )
    .delete(
      '/:userId/sessions',
      {
        params: t.Object({ userId: t.String() }),
      },
      async ({ db, params: { userId } }) => {
        const service = new UserSessionsService(db)
        return service.deleteAll(userId)
      },
    )
    .delete(
      '/:userId/sessions/:sessionId',
      {
        params: t.Object({
          userId: t.String(),
          sessionId: t.String(),
        }),
      },
      async ({ db, params: { userId, sessionId } }) => {
        const service = new UserSessionsService(db)
        return service.delete(userId, sessionId)
      },
    )

    // 18. User Targets
    .get(
      '/:userId/targets',
      {
        params: t.Object({ userId: t.String() }),
        query: t.Object({
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { userId }, query }) => {
        const service = new UserTargetsService(db)
        const queries: Query[] = []
        if (query.limit) queries.push(Query.limit(Number(query.limit)))
        if (query.offset) queries.push(Query.offset(Number(query.offset)))
        return service.findAll(userId, queries)
      },
    )
    .post(
      '/:userId/targets',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({
          providerType: t.String(),
          identifier: t.String(),
          providerId: t.Optional(t.String()),
          name: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UserTargetsService(db)
        return service.create(userId, body)
      },
    )
    .get(
      '/:userId/targets/:targetId',
      {
        params: t.Object({
          userId: t.String(),
          targetId: t.String(),
        }),
      },
      async ({ db, params: { userId, targetId } }) => {
        const service = new UserTargetsService(db)
        return service.findOne(userId, targetId)
      },
    )
    .patch(
      '/:userId/targets/:targetId',
      {
        params: t.Object({
          userId: t.String(),
          targetId: t.String(),
        }),
        body: t.Object({
          identifier: t.Optional(t.String()),
          providerId: t.Optional(t.String()),
          name: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { userId, targetId }, body }) => {
        const service = new UserTargetsService(db)
        return service.update(userId, targetId, body)
      },
    )
    .delete(
      '/:userId/targets/:targetId',
      {
        params: t.Object({
          userId: t.String(),
          targetId: t.String(),
        }),
      },
      async ({ db, params: { userId, targetId } }) => {
        const service = new UserTargetsService(db)
        return service.delete(userId, targetId)
      },
    )

    // 19. User Memberships
    .get(
      '/:userId/memberships',
      {
        params: t.Object({ userId: t.String() }),
        query: t.Object({
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { userId }, query }) => {
        const service = new UsersService(db, options.jwtSecret)
        const queries: Query[] = []
        if (query.limit) queries.push(Query.limit(Number(query.limit)))
        if (query.offset) queries.push(Query.offset(Number(query.offset)))
        return service.getMemberships(userId, queries)
      },
    )

    // 20. User Tokens
    .post(
      '/:userId/tokens',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({
          type: t.Optional(t.Union([t.Number(), t.String()])),
          expireInSeconds: t.Optional(t.Number()),
          phrase: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.createToken(
          userId,
          body.type ?? 1,
          body.expireInSeconds ?? 3600,
          body.phrase,
        )
      },
    )

    // 21. User JWTs
    .post(
      '/:userId/jwts',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({
          sessionId: t.Optional(t.String()),
          duration: t.Optional(t.Number()),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.createJwt(userId, body.sessionId, body.duration)
      },
    )
