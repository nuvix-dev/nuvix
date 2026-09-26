import type { Doc, Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { Users } from '../../types/generated'
import { requireAuth } from '../auth'
import { AccountService } from './service'

export const accountProfileRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
    }))

    // 1. Create account
    .post(
      '',
      {
        detail: {
          summary: 'Create account',
          description: 'Register a new user account with email and password.',
          tags: ['Account Profile'],
        },
        body: t.Object({
          userId: t.Optional(
            t.String({ description: 'Custom unique user ID (alphanumeric, max 36 chars)' }),
          ),
          email: t.String({ format: 'email', description: 'User email address' }),
          password: t.String({ minLength: 8, description: 'User password (minimum 8 characters)' }),
          name: t.Optional(t.String({ maxLength: 128, description: 'User display name' })),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountService(db)
        return service.createAccount(body)
      },
    )

    // 2. Get account
    .get(
      '',
      {
        detail: {
          summary: 'Get account',
          description: 'Retrieve the profile details of the currently authenticated user.',
          tags: ['Account Profile'],
        },
      },
      async ({ db, user }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.getAccount(userId)
      },
    )

    // 3. Delete account
    .delete(
      '',
      {
        detail: {
          summary: 'Delete account',
          description:
            'Permanently delete the currently authenticated user account and all associated sessions.',
          tags: ['Account Profile'],
        },
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Operation status confirmation' }),
          }),
        },
      },
      async ({ db, user }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        await service.deleteAccount(userId)
        return { status: 'ok' as const }
      },
    )

    // 4. Get preferences
    .get(
      '/prefs',
      {
        detail: {
          summary: 'Get preferences',
          description: 'Retrieve user preferences as key-value pairs.',
          tags: ['Account Profile'],
        },
      },
      async ({ db, user }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.getPrefs(userId)
      },
    )

    // 5. Update preferences
    .patch(
      '/prefs',
      {
        detail: {
          summary: 'Update preferences',
          description: 'Update user preferences object (merged with existing preferences).',
          tags: ['Account Profile'],
        },
        body: t.Object({
          prefs: t.Record(t.String(), t.Any(), {
            description: 'Custom key-value user preferences',
          }),
        }),
      },
      async ({ db, user, body }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.updatePrefs(userId, body.prefs)
      },
    )

    // 6. Update name
    .patch(
      '/name',
      {
        detail: {
          summary: 'Update name',
          description: 'Update the display name of the currently authenticated user.',
          tags: ['Account Profile'],
        },
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 128, description: 'New user display name' }),
        }),
      },
      async ({ db, user, body }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.updateName(userId, body.name)
      },
    )

    // 7. Update password
    .patch(
      '/password',
      {
        detail: {
          summary: 'Update password',
          description: 'Change the password of the currently authenticated user.',
          tags: ['Account Profile'],
        },
        body: t.Object({
          password: t.String({ minLength: 8, description: 'New user password' }),
          oldPassword: t.Optional(
            t.String({
              description: 'Current user password (required if account already has a password)',
            }),
          ),
        }),
      },
      async ({ db, user, body }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.updatePassword(userId, body.password, body.oldPassword)
      },
    )

    // 8. Update email
    .patch(
      '/email',
      {
        detail: {
          summary: 'Update email',
          description: 'Change the primary email address of the currently authenticated user.',
          tags: ['Account Profile'],
        },
        body: t.Object({
          email: t.String({ format: 'email', description: 'New user email address' }),
          password: t.Optional(t.String({ description: 'Current password for verification' })),
        }),
      },
      async ({ db, user, body }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.updateEmail(userId, body.email, body.password)
      },
    )

    // 9. Update phone
    .patch(
      '/phone',
      {
        detail: {
          summary: 'Update phone',
          description: 'Change the phone number of the currently authenticated user.',
          tags: ['Account Profile'],
        },
        body: t.Object({
          phone: t.String({ description: 'New phone number in E.164 format' }),
          password: t.Optional(t.String({ description: 'Current password for verification' })),
        }),
      },
      async ({ db, user, body }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.updatePhone(userId, body.phone, body.password)
      },
    )

    // 10. Update status
    .patch(
      '/status',
      {
        detail: {
          summary: 'Update status',
          description: 'Block or unblock the user account.',
          tags: ['Account Profile'],
        },
      },
      async ({ db, user }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.updateStatus(userId)
      },
    )

    // 11. Create email verification
    .post(
      '/verification',
      {
        detail: {
          summary: 'Create email verification',
          description: 'Generate an email verification secret token and send confirmation message.',
          tags: ['Account Verification'],
        },
        body: t.Optional(
          t.Object({
            url: t.Optional(
              t.String({ format: 'uri', description: 'Redirect URL with secret query param' }),
            ),
          }),
        ),
      },
      async ({ db, user, body }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.createEmailVerification(userId, body?.url)
      },
    )
    .post(
      '/verifications/email',
      {
        detail: {
          summary: 'Create email verification (alias)',
          description: 'Alias for POST /account/verification.',
          tags: ['Account Verification'],
        },
        body: t.Optional(
          t.Object({
            url: t.Optional(
              t.String({ format: 'uri', description: 'Redirect URL with secret query param' }),
            ),
          }),
        ),
      },
      async ({ db, user, body }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.createEmailVerification(userId, body?.url)
      },
    )

    // 12. Update email verification
    .put(
      '/verification',
      {
        detail: {
          summary: 'Confirm email verification',
          description: 'Confirm email verification using secret token received by email.',
          tags: ['Account Verification'],
        },
        body: t.Object({
          userId: t.String({ description: 'User ID associated with the token' }),
          secret: t.String({ description: 'Verification secret token' }),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountService(db)
        return service.updateEmailVerification(body.userId, body.secret)
      },
    )
    .put(
      '/verifications/email',
      {
        detail: {
          summary: 'Confirm email verification (alias)',
          description: 'Alias for PUT /account/verification.',
          tags: ['Account Verification'],
        },
        body: t.Object({
          userId: t.String({ description: 'User ID associated with the token' }),
          secret: t.String({ description: 'Verification secret token' }),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountService(db)
        return service.updateEmailVerification(body.userId, body.secret)
      },
    )

    // 13. Create phone verification
    .post(
      '/verification/phone',
      {
        detail: {
          summary: 'Create phone verification',
          description: 'Generate SMS verification OTP and send to user phone.',
          tags: ['Account Verification'],
        },
      },
      async ({ db, user }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.createPhoneVerification(userId)
      },
    )
    .post(
      '/verifications/phone',
      {
        detail: {
          summary: 'Create phone verification (alias)',
          description: 'Alias for POST /account/verification/phone.',
          tags: ['Account Verification'],
        },
      },
      async ({ db, user }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.createPhoneVerification(userId)
      },
    )

    // 14. Update phone verification
    .put(
      '/verification/phone',
      {
        detail: {
          summary: 'Confirm phone verification',
          description: 'Confirm phone number using SMS OTP secret.',
          tags: ['Account Verification'],
        },
        body: t.Object({
          userId: t.String({ description: 'User ID associated with the OTP' }),
          secret: t.String({ description: 'SMS OTP verification secret' }),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountService(db)
        return service.updatePhoneVerification(body.userId, body.secret)
      },
    )
    .put(
      '/verifications/phone',
      {
        detail: {
          summary: 'Confirm phone verification (alias)',
          description: 'Alias for PUT /account/verification/phone.',
          tags: ['Account Verification'],
        },
        body: t.Object({
          userId: t.String({ description: 'User ID associated with the OTP' }),
          secret: t.String({ description: 'SMS OTP verification secret' }),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountService(db)
        return service.updatePhoneVerification(body.userId, body.secret)
      },
    )
