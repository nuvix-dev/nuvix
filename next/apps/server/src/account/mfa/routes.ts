import type { Doc, Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { Sessions, Users } from '../../types/generated'
import { requireAuth } from '../auth'
import { AccountMfaService } from './service'

export const accountMfaRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
      session: ('session' in ctx ? ctx.session : undefined) as unknown as Doc<Sessions>,
    }))

    // 37. Update MFA status
    .patch(
      '/mfa',
      {
        detail: {
          summary: 'Enable/disable MFA',
          description: 'Toggle Multi-Factor Authentication requirement for the user account.',
          tags: ['Account MFA'],
        },
        body: t.Object({
          mfa: t.Boolean({ description: 'True to enforce MFA on login; false to disable' }),
        }),
      },
      async ({ db, user, session, body }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        return service.updateMfa(userId, body.mfa, session?.getId())
      },
    )

    // 38. List MFA factors
    .get(
      '/mfa/factors',
      {
        detail: {
          summary: 'List MFA factors',
          description:
            'Retrieve configured MFA factors (TOTP, recovery codes, email, phone) for the user.',
          tags: ['Account MFA'],
        },
      },
      async ({ db, user }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        return service.getMfaFactors(userId)
      },
    )

    // 39. Create authenticator
    .post(
      '/mfa/authenticators/:type',
      {
        detail: {
          summary: 'Enroll authenticator factor',
          description:
            'Start enrolling a new authenticator factor (e.g. totp) and obtain secret key or URI.',
          tags: ['Account MFA'],
        },
        params: t.Object({
          type: t.String({ description: 'Factor type: "totp"' }),
        }),
      },
      async ({ db, user, params: { type } }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        return service.createMfaAuthenticator(userId, type)
      },
    )

    // 40. Verify authenticator
    .put(
      '/mfa/authenticators/:type',
      {
        detail: {
          summary: 'Verify and activate authenticator',
          description: 'Verify TOTP code to confirm enrollment and activate the factor.',
          tags: ['Account MFA'],
        },
        params: t.Object({
          type: t.String({ description: 'Factor type: "totp"' }),
        }),
        body: t.Object({
          otp: t.String({
            minLength: 6,
            maxLength: 8,
            description: 'One-time passcode from authenticator app',
          }),
        }),
      },
      async ({ db, user, session, params: { type }, body }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        return service.verifyMfaAuthenticator(userId, type, body.otp, session?.getId())
      },
    )

    // 41. Delete authenticator
    .delete(
      '/mfa/authenticators/:type',
      {
        detail: {
          summary: 'Remove authenticator factor',
          description: 'Delete and unenroll an authenticator factor from the user account.',
          tags: ['Account MFA'],
        },
        params: t.Object({
          type: t.String({ description: 'Factor type: "totp"' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Operation status confirmation' }),
          }),
        },
      },
      async ({ db, user, params: { type } }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        await service.deleteMfaAuthenticator(userId, type)
        return { status: 'ok' as const }
      },
    )

    // 42. Create MFA recovery codes
    .post(
      '/mfa/recovery-codes',
      {
        detail: {
          summary: 'Generate recovery codes',
          description: 'Generate a new set of single-use backup recovery codes for MFA.',
          tags: ['Account MFA'],
        },
      },
      async ({ db, user }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        return service.createMfaRecoveryCodes(userId)
      },
    )

    // 43. Regenerate MFA recovery codes
    .patch(
      '/mfa/recovery-codes',
      {
        detail: {
          summary: 'Regenerate recovery codes',
          description: 'Invalidate old recovery codes and generate fresh single-use backup codes.',
          tags: ['Account MFA'],
        },
      },
      async ({ db, user }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        return service.updateMfaRecoveryCodes(userId)
      },
    )

    // 44. Get MFA recovery codes
    .get(
      '/mfa/recovery-codes',
      {
        detail: {
          summary: 'Get remaining recovery codes',
          description: 'View the currently active recovery codes for the user account.',
          tags: ['Account MFA'],
        },
      },
      async ({ db, user }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        return service.getMfaRecoveryCodes(userId)
      },
    )

    // 45. Create MFA challenge
    .post(
      '/mfa/challenge',
      {
        detail: {
          summary: 'Create MFA challenge',
          description: 'Generate an MFA challenge during multi-factor authentication check.',
          tags: ['Account MFA'],
        },
        body: t.Object({
          factor: t.String({
            description: 'Factor to challenge: "totp", "recovery-code", "email", or "phone"',
          }),
        }),
      },
      async ({ db, user, body }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        return service.createMfaChallenge({
          userId,
          factor: body.factor,
        })
      },
    )

    // 46. Complete MFA challenge
    .put(
      '/mfa/challenge',
      {
        detail: {
          summary: 'Verify MFA challenge',
          description:
            'Submit OTP code or recovery code to satisfy MFA challenge and upgrade session.',
          tags: ['Account MFA'],
        },
        body: t.Object({
          challengeId: t.String({ description: 'ID of the active MFA challenge' }),
          otp: t.String({ description: 'Passcode or backup recovery code' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Operation status confirmation' }),
          }),
        },
      },
      async ({ db, user, session, body }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        await service.updateMfaChallenge({
          userId,
          challengeId: body.challengeId,
          otp: body.otp,
          sessionId: session?.getId(),
        })
        return { status: 'ok' as const }
      },
    )
