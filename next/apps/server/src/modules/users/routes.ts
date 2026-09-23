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

export function userRoutes(service: UserService) {
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
      ({ body }) => service.create(body),
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
      ({ body }) => service.createArgon2(body),
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
      ({ body }) => service.createBcrypt(body),
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
      async ({ query }) => {
        const limit = query.limit ?? 25
        const offset = query.offset ?? 0
        const { users, total } = await service.list({
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
      ({ params: { userId } }) => service.get(userId),
    )
    .delete(
      '/users/:userId',
      {
        params: t.Object({ userId: t.String() }),
        response: t.Object({ ok: t.Boolean() }),
        detail: { summary: 'Delete user', tags: ['users'] },
      },
      async ({ params: { userId } }) => {
        await service.delete(userId)
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
      ({ params: { userId }, body }) => service.updateName(userId, body.name),
    )
    .patch(
      '/users/:userId/password',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ password: t.String({ minLength: 8 }) }),
        response: UserSchema,
        detail: { summary: 'Update user password', tags: ['users'] },
      },
      ({ params: { userId }, body }) => service.updatePassword(userId, body.password),
    )
    .patch(
      '/users/:userId/email',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ email: t.String({ format: 'email' }) }),
        response: UserSchema,
        detail: { summary: 'Update user email', tags: ['users'] },
      },
      ({ params: { userId }, body }) => service.updateEmail(userId, body.email),
    )
    .patch(
      '/users/:userId/phone',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ phone: t.String({ minLength: 1 }) }),
        response: UserSchema,
        detail: { summary: 'Update user phone', tags: ['users'] },
      },
      ({ params: { userId }, body }) => service.updatePhone(userId, body.phone),
    )
    .patch(
      '/users/:userId/verification',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ emailVerification: t.Boolean() }),
        response: UserSchema,
        detail: { summary: 'Update email verification flag', tags: ['users'] },
      },
      ({ params: { userId }, body }) => service.updateVerification(userId, body.emailVerification),
    )
    .patch(
      '/users/:userId/verification/phone',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ phoneVerification: t.Boolean() }),
        response: UserSchema,
        detail: { summary: 'Update phone verification flag', tags: ['users'] },
      },
      ({ params: { userId }, body }) =>
        service.updatePhoneVerification(userId, body.phoneVerification),
    )
    .get(
      '/users/:userId/prefs',
      {
        params: t.Object({ userId: t.String() }),
        response: t.Record(t.String(), t.Any()),
        detail: { summary: 'Get user preferences', tags: ['users'] },
      },
      ({ params: { userId } }) => service.getPrefs(userId),
    )
    .patch(
      '/users/:userId/prefs',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Record(t.String(), t.Any()),
        response: t.Record(t.String(), t.Any()),
        detail: { summary: 'Merge user preferences', tags: ['users'] },
      },
      ({ params: { userId }, body }) => service.updatePrefs(userId, body),
    )
    .put(
      '/users/:userId/labels',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ labels: t.Array(t.String()) }),
        response: UserSchema,
        detail: { summary: 'Replace user labels', tags: ['users'] },
      },
      ({ params: { userId }, body }) => service.updateLabels(userId, body.labels),
    )
    .patch(
      '/users/:userId/status',
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ status: t.Boolean() }),
        response: UserSchema,
        detail: { summary: 'Update user status', tags: ['users'] },
      },
      ({ params: { userId }, body }) => service.updateStatus(userId, body.status),
    )
}
