import { type Doc, Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { UnauthorizedError } from '../../shared/errors'
import type { Sessions, Users } from '../../types/generated'
import { AccountIdentitiesService } from './identities.service'
import { AccountMfaService } from './mfa.service'
import { AccountRecoveryService } from './recovery.service'
import { AccountService } from './service'
import { AccountSessionsService } from './sessions.service'
import { AccountTargetsService } from './targets.service'

function requireAuth(user?: Doc<Users>): string {
  if (!user || user.empty()) {
    throw new UnauthorizedError('Unauthorized', { code: 'user_unauthorized' })
  }
  return user.getId()
}

export const accountRoutes = (options: { jwtSecret?: string } = {}) =>
  new Elysia({ prefix: '/account' })
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
      session: ('session' in ctx ? ctx.session : undefined) as unknown as Doc<Sessions>,
    }))

    // 1. Create account
    .post(
      '',
      {
        body: t.Object({
          userId: t.Optional(t.String()),
          email: t.String(),
          password: t.String(),
          name: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountService(db)
        return service.createAccount(body)
      },
    )

    // 2. Get account
    .get('', async ({ db, user }) => {
      const userId = requireAuth(user)
      const service = new AccountService(db)
      return service.getAccount(userId)
    })

    // 3. Delete account
    .delete('', async ({ db, user }) => {
      const userId = requireAuth(user)
      const service = new AccountService(db)
      await service.deleteAccount(userId)
      return { status: 'ok' }
    })

    // 4. Get preferences
    .get('/prefs', async ({ db, user }) => {
      const userId = requireAuth(user)
      const service = new AccountService(db)
      return service.getPrefs(userId)
    })

    // 5. Update preferences
    .patch(
      '/prefs',
      {
        body: t.Object({
          prefs: t.Record(t.String(), t.Any()),
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
        body: t.Object({
          name: t.String(),
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
        body: t.Object({
          password: t.String(),
          oldPassword: t.Optional(t.String()),
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
        body: t.Object({
          email: t.String(),
          password: t.Optional(t.String()),
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
        body: t.Object({
          phone: t.String(),
          password: t.Optional(t.String()),
        }),
      },
      async ({ db, user, body }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.updatePhone(userId, body.phone, body.password)
      },
    )

    // 10. Update status
    .patch('/status', async ({ db, user }) => {
      const userId = requireAuth(user)
      const service = new AccountService(db)
      return service.updateStatus(userId)
    })

    // 11. Create email verification (and alias verifications/email)
    .post(
      '/verification',
      {
        body: t.Optional(
          t.Object({
            url: t.Optional(t.String()),
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
        body: t.Optional(
          t.Object({
            url: t.Optional(t.String()),
          }),
        ),
      },
      async ({ db, user, body }) => {
        const userId = requireAuth(user)
        const service = new AccountService(db)
        return service.createEmailVerification(userId, body?.url)
      },
    )

    // 12. Update email verification (and alias verifications/email)
    .put(
      '/verification',
      {
        body: t.Object({
          userId: t.String(),
          secret: t.String(),
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
        body: t.Object({
          userId: t.String(),
          secret: t.String(),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountService(db)
        return service.updateEmailVerification(body.userId, body.secret)
      },
    )

    // 13. Create phone verification (and alias verifications/phone)
    .post('/verification/phone', async ({ db, user }) => {
      const userId = requireAuth(user)
      const service = new AccountService(db)
      return service.createPhoneVerification(userId)
    })
    .post('/verifications/phone', async ({ db, user }) => {
      const userId = requireAuth(user)
      const service = new AccountService(db)
      return service.createPhoneVerification(userId)
    })

    // 14. Update phone verification (and alias verifications/phone)
    .put(
      '/verification/phone',
      {
        body: t.Object({
          userId: t.String(),
          secret: t.String(),
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
        body: t.Object({
          userId: t.String(),
          secret: t.String(),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountService(db)
        return service.updatePhoneVerification(body.userId, body.secret)
      },
    )

    // 15. Create recovery
    .post(
      '/recovery',
      {
        body: t.Object({
          email: t.String(),
          url: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountRecoveryService(db)
        return service.createRecovery(body)
      },
    )

    // 16. Update recovery (confirm)
    .put(
      '/recovery',
      {
        body: t.Object({
          userId: t.String(),
          secret: t.String(),
          password: t.String(),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountRecoveryService(db)
        return service.updateRecovery(body)
      },
    )

    // 17. List sessions
    .get('/sessions', async ({ db, user, session }) => {
      const userId = requireAuth(user)
      const service = new AccountSessionsService(db, options.jwtSecret)
      return service.getSessions(userId, session?.getId())
    })

    // 18. Delete sessions
    .delete('/sessions', async ({ db, user }) => {
      const userId = requireAuth(user)
      const service = new AccountSessionsService(db, options.jwtSecret)
      await service.deleteSessions(userId)
      return { status: 'ok' }
    })

    // 19. Get session
    .get(
      '/sessions/:sessionId',
      {
        params: t.Object({
          sessionId: t.String(),
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
        params: t.Object({
          sessionId: t.String(),
        }),
      },
      async ({ db, user, session, params: { sessionId } }) => {
        const userId = requireAuth(user)
        const service = new AccountSessionsService(db, options.jwtSecret)
        await service.deleteSession(userId, sessionId, session?.getId())
        return { status: 'ok' }
      },
    )

    // 21. Update session (extend)
    .patch(
      '/sessions/:sessionId',
      {
        params: t.Object({
          sessionId: t.String(),
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
        body: t.Object({
          email: t.String(),
          password: t.String(),
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
        body: t.Object({
          email: t.String(),
          password: t.String(),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createEmailSession(body)
        return res.session
      },
    )

    // 23. Create anonymous session
    .post('/sessions/anonymous', async ({ db }) => {
      const service = new AccountSessionsService(db, options.jwtSecret)
      const res = await service.createAnonymousSession({})
      return res.session
    })

    // 24. Create session with token
    .post(
      '/sessions/token',
      {
        body: t.Object({
          userId: t.String(),
          secret: t.String(),
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
        body: t.Object({
          userId: t.String(),
          secret: t.String(),
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
        body: t.Object({
          userId: t.String(),
          secret: t.String(),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        const res = await service.createSessionWithToken(body)
        return res.session
      },
    )

    // 27. Create magic URL token
    .post(
      '/tokens/magic-url',
      {
        body: t.Object({
          userId: t.Optional(t.String()),
          email: t.String(),
          url: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        return service.createMagicURLToken(body)
      },
    )

    // 28. Create email token (OTP)
    .post(
      '/tokens/email',
      {
        body: t.Object({
          userId: t.Optional(t.String()),
          email: t.String(),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        return service.createEmailToken(body)
      },
    )

    // 29. Create phone token (and alias /sessions/phone)
    .post(
      '/tokens/phone',
      {
        body: t.Object({
          userId: t.Optional(t.String()),
          phone: t.String(),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        return service.createPhoneToken(body)
      },
    )
    .post(
      '/sessions/phone',
      {
        body: t.Object({
          userId: t.Optional(t.String()),
          phone: t.String(),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountSessionsService(db, options.jwtSecret)
        return service.createPhoneToken(body)
      },
    )

    // 30. Create JWT (and alias /jwt)
    .post('/jwts', async ({ db, user, session }) => {
      const userId = requireAuth(user)
      const service = new AccountSessionsService(db, options.jwtSecret)
      return service.createJWT(userId, session?.getId())
    })
    .post('/jwt', async ({ db, user, session }) => {
      const userId = requireAuth(user)
      const service = new AccountSessionsService(db, options.jwtSecret)
      return service.createJWT(userId, session?.getId())
    })

    // 31. List identities
    .get(
      '/identities',
      {
        query: t.Optional(
          t.Object({
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
          }),
        ),
      },
      async ({ db, user, query }) => {
        const userId = requireAuth(user)
        const service = new AccountIdentitiesService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        return service.getIdentities(userId, queries)
      },
    )

    // 32. Delete identity
    .delete(
      '/identities/:identityId',
      {
        params: t.Object({
          identityId: t.String(),
        }),
      },
      async ({ db, user, params: { identityId } }) => {
        const userId = requireAuth(user)
        const service = new AccountIdentitiesService(db)
        await service.deleteIdentity(userId, identityId)
        return { status: 'ok' }
      },
    )

    // 33. Create push target
    .post(
      '/targets/push',
      {
        body: t.Object({
          targetId: t.Optional(t.String()),
          identifier: t.String(),
          providerId: t.Optional(t.String()),
          name: t.Optional(t.String()),
        }),
      },
      async ({ db, user, session, body }) => {
        const userId = requireAuth(user)
        const service = new AccountTargetsService(db)
        return service.createPushTarget({
          userId,
          sessionId: session?.getId(),
          ...body,
        })
      },
    )

    // 34. Update push target
    .put(
      '/targets/:targetId/push',
      {
        params: t.Object({
          targetId: t.String(),
        }),
        body: t.Object({
          identifier: t.Optional(t.String()),
          name: t.Optional(t.String()),
        }),
      },
      async ({ db, user, params: { targetId }, body }) => {
        const userId = requireAuth(user)
        const service = new AccountTargetsService(db)
        return service.updatePushTarget({
          userId,
          targetId,
          ...body,
        })
      },
    )

    // 35. Delete push target
    .delete(
      '/targets/:targetId/push',
      {
        params: t.Object({
          targetId: t.String(),
        }),
      },
      async ({ db, user, params: { targetId } }) => {
        const userId = requireAuth(user)
        const service = new AccountTargetsService(db)
        await service.deletePushTarget(userId, targetId)
        return { status: 'ok' }
      },
    )

    // 36. Update MFA
    .patch(
      '/mfa',
      {
        body: t.Object({
          mfa: t.Boolean(),
        }),
      },
      async ({ db, user, session, body }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        return service.updateMfa(userId, body.mfa, session?.getId())
      },
    )

    // 37. List MFA factors
    .get('/mfa/factors', async ({ db, user }) => {
      const userId = requireAuth(user)
      const service = new AccountMfaService(db)
      return service.getMfaFactors(userId)
    })

    // 38. Create authenticator
    .post(
      '/mfa/authenticators/:type',
      {
        params: t.Object({
          type: t.String(),
        }),
      },
      async ({ db, user, params: { type } }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        return service.createMfaAuthenticator(userId, type)
      },
    )

    // 39. Verify authenticator
    .put(
      '/mfa/authenticators/:type',
      {
        params: t.Object({
          type: t.String(),
        }),
        body: t.Object({
          otp: t.String(),
        }),
      },
      async ({ db, user, session, params: { type }, body }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        return service.verifyMfaAuthenticator(userId, type, body.otp, session?.getId())
      },
    )

    // 40. Delete authenticator
    .delete(
      '/mfa/authenticators/:type',
      {
        params: t.Object({
          type: t.String(),
        }),
      },
      async ({ db, user, params: { type } }) => {
        const userId = requireAuth(user)
        const service = new AccountMfaService(db)
        await service.deleteMfaAuthenticator(userId, type)
        return { status: 'ok' }
      },
    )

    // 41. Create MFA recovery codes
    .post('/mfa/recovery-codes', async ({ db, user }) => {
      const userId = requireAuth(user)
      const service = new AccountMfaService(db)
      return service.createMfaRecoveryCodes(userId)
    })

    // 42. Update MFA recovery codes
    .patch('/mfa/recovery-codes', async ({ db, user }) => {
      const userId = requireAuth(user)
      const service = new AccountMfaService(db)
      return service.updateMfaRecoveryCodes(userId)
    })

    // 43. Get MFA recovery codes
    .get('/mfa/recovery-codes', async ({ db, user }) => {
      const userId = requireAuth(user)
      const service = new AccountMfaService(db)
      return service.getMfaRecoveryCodes(userId)
    })

    // 44. Create MFA challenge
    .post(
      '/mfa/challenge',
      {
        body: t.Object({
          factor: t.String(),
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

    // 45. Update MFA challenge
    .put(
      '/mfa/challenge',
      {
        body: t.Object({
          challengeId: t.String(),
          otp: t.String(),
        }),
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
        return { status: 'ok' }
      },
    )
