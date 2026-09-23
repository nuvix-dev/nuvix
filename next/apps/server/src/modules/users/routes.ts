import { Elysia, t } from 'elysia'
import type { UserService } from './service'

const TargetSchema = t.Object({
  $id: t.String(),
  providerType: t.String(),
  providerId: t.String(),
  identifier: t.String(),
  name: t.String(),
  expired: t.Boolean(),
})

export const UserSchema = t.Object({
  $id: t.String(),
  name: t.String(),
  email: t.String(),
  phone: t.String(),
  status: t.Boolean(),
  labels: t.Array(t.String()),
  passwordUpdate: t.String(),
  registration: t.String(),
  emailVerification: t.Boolean(),
  phoneVerification: t.Boolean(),
  mfa: t.Boolean(),
  prefs: t.Record(t.String(), t.Any()),
  accessedAt: t.String(),
  hash: t.Optional(t.String()),
  hashOptions: t.Optional(t.Record(t.String(), t.Any())),
  passwordHash: t.Optional(t.String()),
  targets: t.Array(TargetSchema),
  $createdAt: t.Optional(t.String()),
  $updatedAt: t.Optional(t.String()),
})

export type UserServiceResolver =
  | UserService
  | ((request: Request) => Promise<UserService> | UserService)

function getService(
  service: UserServiceResolver,
  request: Request,
): Promise<UserService> | UserService {
  return typeof service === 'function' ? service(request) : service
}

export function userRoutes(service: UserServiceResolver) {
  return new Elysia({ name: 'user-routes' })
    .post(
      '/users',
      {
        body: t.Object({
          userId: t.Optional(t.String()),
          email: t.Optional(t.String({ format: 'email' })),
          phone: t.Optional(t.String()),
          password: t.Optional(t.String({ minLength: 8 })),
          name: t.Optional(t.String()),
        }),
        response: UserSchema,
        detail: { summary: 'Create user', tags: ['users'] },
      },
      async ({ body, request }) => (await getService(service, request)).create(body),
    )
    .post(
      '/users/argon2',
      {
        body: t.Object({
          userId: t.Optional(t.String()),
          email: t.Optional(t.String({ format: 'email' })),
          phone: t.Optional(t.String()),
          password: t.String(),
          hashOptions: t.Optional(t.Record(t.String(), t.Any())),
          name: t.Optional(t.String()),
        }),
        response: UserSchema,
        detail: { summary: 'Create user with Argon2 hash', tags: ['users'] },
      },
      async ({ body, request }) => (await getService(service, request)).createArgon2(body),
    )
    .post(
      '/users/bcrypt',
      {
        body: t.Object({
          userId: t.Optional(t.String()),
          email: t.Optional(t.String({ format: 'email' })),
          phone: t.Optional(t.String()),
          password: t.String(),
          name: t.Optional(t.String()),
        }),
        response: UserSchema,
        detail: { summary: 'Create user with Bcrypt hash', tags: ['users'] },
      },
      async ({ body, request }) => (await getService(service, request)).createBcrypt(body),
    )
    .get(
      '/users',
      {
        query: t.Object({
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
          offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
          search: t.Optional(t.String()),
        }),
        response: t.Object({
          data: t.Array(UserSchema),
          meta: t.Object({
            total: t.Number(),
            limit: t.Number(),
            offset: t.Number(),
          }),
        }),
        detail: { summary: 'List users', tags: ['users'] },
      },
      async ({ query, request }) => {
        const limit = query.limit ?? 25
        const offset = query.offset ?? 0
        const svc = await getService(service, request)
        const { users, total } = await svc.list({
          limit,
          offset,
          search: query.search,
        })
        return {
          data: users,
          meta: { total, limit, offset },
        }
      },
    )
    .get(
      '/users/:userId',
      {
        params: t.Object({ userId: t.String() }),
        response: UserSchema,
        detail: { summary: 'Get user', tags: ['users'] },
      },
      async ({ params: { userId }, request }) => (await getService(service, request)).get(userId),
    )
    .delete(
      '/users/:userId',
      {
        params: t.Object({ userId: t.String() }),
        response: t.Object({ ok: t.Boolean() }),
        detail: { summary: 'Delete user', tags: ['users'] },
      },
      async ({ params: { userId }, request }) => {
        await (await getService(service, request)).delete(userId)
        return { ok: true }
      },
    )
    .patch(
      '/users/:userId/name',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ name: t.String({ minLength: 1 }) }),
        response: UserSchema,
        detail: { summary: 'Update user name', tags: ['users'] },
      },
      async ({ params: { userId }, body, request }) =>
        (await getService(service, request)).updateName(userId, body.name),
    )
    .patch(
      '/users/:userId/password',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ password: t.String({ minLength: 8 }) }),
        response: UserSchema,
        detail: { summary: 'Update user password', tags: ['users'] },
      },
      async ({ params: { userId }, body, request }) =>
        (await getService(service, request)).updatePassword(userId, body.password),
    )
    .patch(
      '/users/:userId/email',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ email: t.String({ format: 'email' }) }),
        response: UserSchema,
        detail: { summary: 'Update user email', tags: ['users'] },
      },
      async ({ params: { userId }, body, request }) =>
        (await getService(service, request)).updateEmail(userId, body.email),
    )
    .patch(
      '/users/:userId/phone',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ phone: t.String({ minLength: 1 }) }),
        response: UserSchema,
        detail: { summary: 'Update user phone', tags: ['users'] },
      },
      async ({ params: { userId }, body, request }) =>
        (await getService(service, request)).updatePhone(userId, body.phone),
    )
    .patch(
      '/users/:userId/verification',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ emailVerification: t.Boolean() }),
        response: UserSchema,
        detail: { summary: 'Update email verification flag', tags: ['users'] },
      },
      async ({ params: { userId }, body, request }) =>
        (await getService(service, request)).updateVerification(userId, body.emailVerification),
    )
    .patch(
      '/users/:userId/verification/phone',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ phoneVerification: t.Boolean() }),
        response: UserSchema,
        detail: { summary: 'Update phone verification flag', tags: ['users'] },
      },
      async ({ params: { userId }, body, request }) =>
        (await getService(service, request)).updatePhoneVerification(
          userId,
          body.phoneVerification,
        ),
    )
    .get(
      '/users/:userId/prefs',
      {
        params: t.Object({ userId: t.String() }),
        response: t.Record(t.String(), t.Any()),
        detail: { summary: 'Get user preferences', tags: ['users'] },
      },
      async ({ params: { userId }, request }) =>
        (await getService(service, request)).getPrefs(userId),
    )
    .patch(
      '/users/:userId/prefs',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Record(t.String(), t.Any()),
        response: t.Record(t.String(), t.Any()),
        detail: { summary: 'Merge user preferences', tags: ['users'] },
      },
      async ({ params: { userId }, body, request }) =>
        (await getService(service, request)).updatePrefs(userId, body),
    )
    .put(
      '/users/:userId/labels',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ labels: t.Array(t.String()) }),
        response: UserSchema,
        detail: { summary: 'Replace user labels', tags: ['users'] },
      },
      async ({ params: { userId }, body, request }) =>
        (await getService(service, request)).updateLabels(userId, body.labels),
    )
    .patch(
      '/users/:userId/status',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ status: t.Boolean() }),
        response: UserSchema,
        detail: { summary: 'Update user status', tags: ['users'] },
      },
      async ({ params: { userId }, body, request }) =>
        (await getService(service, request)).updateStatus(userId, body.status),
    )
}
