import { Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { UsersService } from './service'

export const userCoreRoutes = (options: { jwtSecret?: string } = {}) =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))

    // 1. List users
    .get(
      '',
      {
        detail: {
          summary: 'List users',
          description:
            'Retrieve a paginated list of users in the project with optional search and filter queries.',
          tags: ['Users Core'],
        },
        query: t.Object({
          search: t.Optional(
            t.String({
              description: 'Search term matching name, email, phone, or user ID',
            }),
          ),
          limit: t.Optional(
            t.String({
              description: 'Maximum number of users to return',
              pattern: '^[0-9]+$',
            }),
          ),
          offset: t.Optional(
            t.String({
              description: 'Number of users to skip before returning results',
              pattern: '^[0-9]+$',
            }),
          ),
          cursor: t.Optional(
            t.String({
              description: 'Cursor pagination token for the next page of results',
            }),
          ),
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

    // 2. Create user (default Argon2id)
    .post(
      '',
      {
        detail: {
          summary: 'Create user',
          description:
            'Create a new user profile with password hashed using the default server algorithm (Argon2id).',
          tags: ['Users Core'],
        },
        body: t.Object({
          userId: t.Optional(
            t.String({
              description: 'Custom unique user identifier. If omitted, a unique ID is generated.',
            }),
          ),
          email: t.Optional(
            t.String({
              description: 'User email address',
              format: 'email',
            }),
          ),
          phone: t.Optional(
            t.String({
              description: 'User phone number in international E.164 format',
            }),
          ),
          password: t.Optional(
            t.String({
              description: 'Plaintext password to be securely hashed',
              minLength: 8,
            }),
          ),
          name: t.Optional(
            t.String({
              description: 'User full display name',
            }),
          ),
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
        detail: {
          summary: 'Create user with Argon2',
          description: 'Create a user with explicit Argon2id hashing configuration.',
          tags: ['Users Core'],
        },
        body: t.Object({
          userId: t.Optional(
            t.String({
              description: 'Custom unique user identifier',
            }),
          ),
          email: t.Optional(
            t.String({
              description: 'User email address',
              format: 'email',
            }),
          ),
          phone: t.Optional(
            t.String({
              description: 'User phone number in international E.164 format',
            }),
          ),
          password: t.Optional(
            t.String({
              description: 'User password to hash',
              minLength: 8,
            }),
          ),
          name: t.Optional(
            t.String({
              description: 'User full display name',
            }),
          ),
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
        detail: {
          summary: 'Create user with Bcrypt',
          description: 'Create a user with explicit Bcrypt hashing algorithm.',
          tags: ['Users Core'],
        },
        body: t.Object({
          userId: t.Optional(
            t.String({
              description: 'Custom unique user identifier',
            }),
          ),
          email: t.Optional(
            t.String({
              description: 'User email address',
              format: 'email',
            }),
          ),
          phone: t.Optional(
            t.String({
              description: 'User phone number in international E.164 format',
            }),
          ),
          password: t.Optional(
            t.String({
              description: 'User password to hash',
              minLength: 8,
            }),
          ),
          name: t.Optional(
            t.String({
              description: 'User full display name',
            }),
          ),
        }),
      },
      async ({ db, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.createBcrypt(body)
      },
    )

    // 5. Usage stats (must precede /:userId to avoid path parameter matching)
    .get(
      '/usage',
      {
        detail: {
          summary: 'Get user usage statistics',
          description:
            'Aggregate administrative usage statistics for users and sessions over a time range.',
          tags: ['Users Core'],
        },
        query: t.Object({
          range: t.Optional(
            t.String({
              description: 'Time window range for usage metrics (e.g. 24h, 7d, 30d, 90d)',
              default: '30d',
            }),
          ),
        }),
      },
      async ({ db, query }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.getUsage(query.range)
      },
    )

    // 6. Get user by ID
    .get(
      '/:userId',
      {
        detail: {
          summary: 'Get user by ID',
          description: 'Retrieve detailed profile information for a specific user.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
      },
      async ({ db, params: { userId } }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.findOne(userId)
      },
    )

    // 7. Delete user by ID
    .delete(
      '/:userId',
      {
        detail: {
          summary: 'Delete user by ID',
          description:
            'Permanently delete a user account along with their sessions, tokens, and registered targets.',
          tags: ['Users Core'],
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
        const service = new UsersService(db, options.jwtSecret)
        return service.delete(userId)
      },
    )

    // 8. Update user status
    .patch(
      '/:userId/status',
      {
        detail: {
          summary: 'Update user status',
          description: 'Enable or suspend/block a user account.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          status: t.Boolean({
            description: 'User active status: true to activate/enable, false to suspend/block',
          }),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updateStatus(userId, body.status)
      },
    )

    // 9. Update user name
    .patch(
      '/:userId/name',
      {
        detail: {
          summary: 'Update user name',
          description: 'Update the full display name of a user.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          name: t.String({
            description: 'New full display name for the user',
          }),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updateName(userId, body.name)
      },
    )

    // 10. Update user email
    .patch(
      '/:userId/email',
      {
        detail: {
          summary: 'Update user email',
          description:
            'Update the primary email address of a user and reset email verification status.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          email: t.String({
            description: 'New email address for the user',
            format: 'email',
          }),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updateEmail(userId, body.email)
      },
    )

    // 11. Update user phone
    .patch(
      '/:userId/phone',
      {
        detail: {
          summary: 'Update user phone',
          description:
            'Update the primary phone number of a user and reset phone verification status.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          phone: t.String({
            description: 'New phone number in international E.164 format',
          }),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updatePhone(userId, body.phone)
      },
    )

    // 12. Update user password
    .patch(
      '/:userId/password',
      {
        detail: {
          summary: 'Update user password',
          description: 'Update and re-hash the password of a user account.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          password: t.String({
            description: 'New plaintext password to set',
            minLength: 8,
          }),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updatePassword(userId, body.password)
      },
    )

    // 13. Update user labels
    .put(
      '/:userId/labels',
      {
        detail: {
          summary: 'Update user labels',
          description:
            'Replace the list of administrative tags/labels assigned to a user for access control and categorization.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          labels: t.Array(
            t.String({
              description: 'Alphanumeric label tag',
            }),
            {
              description: 'Complete replacement array of labels for the user',
            },
          ),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updateLabels(userId, body.labels)
      },
    )

    // 14. Update email verification status
    .patch(
      '/:userId/verification',
      {
        detail: {
          summary: 'Update email verification',
          description:
            'Directly set the email verification flag for a user without sending a link.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          emailVerification: t.Boolean({
            description: 'Whether the email is verified (true) or unverified (false)',
          }),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updateEmailVerification(userId, body.emailVerification)
      },
    )

    // 15. Update phone verification status
    .patch(
      '/:userId/verification/phone',
      {
        detail: {
          summary: 'Update phone verification',
          description:
            'Directly set the phone verification flag for a user without sending an OTP.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          phoneVerification: t.Boolean({
            description: 'Whether the phone number is verified (true) or unverified (false)',
          }),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updatePhoneVerification(userId, body.phoneVerification)
      },
    )

    // 16. Get user preferences
    .get(
      '/:userId/prefs',
      {
        detail: {
          summary: 'Get user preferences',
          description: 'Retrieve custom arbitrary key-value preferences stored for the user.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
      },
      async ({ db, params: { userId } }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.getPrefs(userId)
      },
    )

    // 17. Update user preferences
    .patch(
      '/:userId/prefs',
      {
        detail: {
          summary: 'Update user preferences',
          description: 'Merge or update custom key-value preference pairs for the user.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          prefs: t.Record(t.String(), t.Any(), {
            description: 'JSON object with custom user preference settings',
          }),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.updatePrefs(userId, body.prefs)
      },
    )

    // 18. Get user memberships
    .get(
      '/:userId/memberships',
      {
        detail: {
          summary: 'List user team memberships',
          description: 'Retrieve team memberships that the specified user belongs to.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        query: t.Object({
          limit: t.Optional(
            t.String({
              description: 'Maximum number of memberships to return',
              pattern: '^[0-9]+$',
            }),
          ),
          offset: t.Optional(
            t.String({
              description: 'Number of memberships to skip',
              pattern: '^[0-9]+$',
            }),
          ),
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

    // 19. Create user token
    .post(
      '/:userId/tokens',
      {
        detail: {
          summary: 'Create user token',
          description:
            'Generate a temporary secret verification or authentication token for the user.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          type: t.Optional(
            t.Union([t.Number(), t.String()], {
              description: 'Token type numeric code or string name',
              default: 1,
            }),
          ),
          expireInSeconds: t.Optional(
            t.Number({
              description: 'Token lifespan in seconds before expiration',
              default: 3600,
            }),
          ),
          phrase: t.Optional(
            t.String({
              description: 'Optional human-readable phrase or custom identifier',
            }),
          ),
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

    // 20. Create user JWT
    .post(
      '/:userId/jwts',
      {
        detail: {
          summary: 'Create user JWT',
          description:
            'Issue a signed JSON Web Token (JWT) on behalf of a user for short-lived client authentication.',
          tags: ['Users Core'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          sessionId: t.Optional(
            t.String({
              description: 'Optional active session ID to bind the JWT claim to',
            }),
          ),
          duration: t.Optional(
            t.Number({
              description: 'JWT validity duration in seconds (default: 900)',
              default: 900,
            }),
          ),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UsersService(db, options.jwtSecret)
        return service.createJwt(userId, body.sessionId, body.duration)
      },
    )
