import { Elysia, t } from 'elysia'
import { NotFoundError, UnauthorizedError } from '../../shared/errors'
import type { RequestMetadata } from '../sessions/operations/create'
import type { SessionsService } from '../sessions/service'
import type { AccountService } from './service'

export const TargetSchema = t.Object({
  $id: t.String(),
  providerType: t.String(),
  providerId: t.String(),
  identifier: t.String(),
  name: t.String(),
  expired: t.Boolean(),
})

export const AccountSchema = t.Object({
  $id: t.String(),
  name: t.String(),
  email: t.String(),
  phone: t.String(),
  emailVerification: t.Boolean(),
  phoneVerification: t.Boolean(),
  status: t.Boolean(),
  labels: t.Array(t.String()),
  mfa: t.Boolean(),
  prefs: t.Record(t.String(), t.Any()),
  targets: t.Array(TargetSchema),
  accessedAt: t.String(),
  registration: t.String(),
  $createdAt: t.Optional(t.String()),
  $updatedAt: t.Optional(t.String()),
})

export const SessionResponseSchema = t.Object({
  $id: t.String(),
  $createdAt: t.Optional(t.String()),
  $updatedAt: t.Optional(t.String()),
  userId: t.String(),
  expire: t.String(),
  provider: t.String(),
  providerUid: t.String(),
  providerAccessToken: t.String(),
  providerAccessTokenExpiry: t.String(),
  providerRefreshToken: t.String(),
  ip: t.String(),
  osCode: t.String(),
  osName: t.String(),
  osVersion: t.String(),
  clientType: t.String(),
  clientCode: t.String(),
  clientName: t.String(),
  clientVersion: t.String(),
  clientEngine: t.String(),
  clientEngineVersion: t.String(),
  deviceName: t.String(),
  deviceBrand: t.String(),
  deviceModel: t.String(),
  countryCode: t.String(),
  current: t.Boolean(),
  factors: t.Array(t.String()),
  secret: t.Optional(t.String()),
})

export const IdentitySchema = t.Object({
  $id: t.String(),
  $createdAt: t.Optional(t.String()),
  $updatedAt: t.Optional(t.String()),
  userId: t.String(),
  provider: t.String(),
  providerUid: t.String(),
  providerEmail: t.String(),
  providerAccessToken: t.String(),
  providerAccessTokenExpiry: t.String(),
  providerRefreshToken: t.String(),
})

export const MfaFactorsSchema = t.Object({
  totp: t.Boolean(),
  email: t.Boolean(),
  phone: t.Boolean(),
  recoveryCode: t.Boolean(),
})

export interface AuthUserContext {
  userId?: string
  sessionId?: string
}

function requireUserId(caller: AuthUserContext): string {
  if (!caller.userId) {
    throw new UnauthorizedError('Authentication required', { code: 'user_unauthorized' })
  }
  return caller.userId
}

export type AccountServiceResolver =
  | AccountService
  | ((request: Request) => Promise<AccountService> | AccountService)

export type SessionsServiceResolver =
  | SessionsService
  | ((request: Request) => Promise<SessionsService> | SessionsService)

function getAccountService(
  service: AccountServiceResolver,
  request: Request,
): Promise<AccountService> | AccountService {
  return typeof service === 'function' ? service(request) : service
}

function getSessionsService(
  service?: SessionsServiceResolver,
  request?: Request,
): Promise<SessionsService | undefined> | SessionsService | undefined {
  if (!service || !request) return undefined
  return typeof service === 'function' ? service(request) : service
}

export function accountRoutes(
  service: AccountServiceResolver,
  jwtSecret: string,
  getAuthUser: (request: Request) => AuthUserContext = () => ({}),
  getReqMeta: (request: Request) => RequestMetadata = () => ({}),
  sessionsService?: SessionsServiceResolver,
) {
  return (
    new Elysia({ name: 'account-routes' })
      .post(
        '/account',
        {
          body: t.Object({
            userId: t.Optional(t.String()),
            email: t.String({ format: 'email' }),
            password: t.String({ minLength: 8 }),
            name: t.Optional(t.String()),
          }),
          response: t.Object({
            account: AccountSchema,
            session: SessionResponseSchema,
          }),
          detail: { summary: 'Create account', tags: ['account'] },
        },
        async ({ body, request }) =>
          (await getAccountService(service, request)).create(body, getReqMeta(request)),
      )
      .get(
        '/account',
        {
          response: AccountSchema,
          detail: { summary: 'Get current account', tags: ['account'] },
        },
        async ({ request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).get(userId)
        },
      )
      .delete(
        '/account',
        {
          response: t.Object({ ok: t.Boolean() }),
          detail: { summary: 'Delete own account', tags: ['account'] },
        },
        async ({ request }) => {
          const userId = requireUserId(getAuthUser(request))
          await (await getAccountService(service, request)).delete(userId)
          return { ok: true }
        },
      )
      .get(
        '/account/prefs',
        {
          response: t.Record(t.String(), t.Any()),
          detail: { summary: 'Get account preferences', tags: ['account'] },
        },
        async ({ request }) => {
          const userId = requireUserId(getAuthUser(request))
          const account = await (await getAccountService(service, request)).get(userId)
          return account.prefs
        },
      )
      .patch(
        '/account/prefs',
        {
          body: t.Record(t.String(), t.Any()),
          response: t.Record(t.String(), t.Any()),
          detail: { summary: 'Update account preferences', tags: ['account'] },
        },
        async ({ body, request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).updatePrefs(userId, body)
        },
      )
      .patch(
        '/account/name',
        {
          body: t.Object({ name: t.String({ minLength: 1 }) }),
          response: AccountSchema,
          detail: { summary: 'Update account name', tags: ['account'] },
        },
        async ({ body, request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).updateName(userId, body.name)
        },
      )
      .patch(
        '/account/password',
        {
          body: t.Object({
            password: t.String({ minLength: 8 }),
            oldPassword: t.Optional(t.String()),
          }),
          response: AccountSchema,
          detail: { summary: 'Update account password', tags: ['account'] },
        },
        async ({ body, request }) => {
          const caller = getAuthUser(request)
          const userId = requireUserId(caller)
          return (await getAccountService(service, request)).updatePassword(
            userId,
            caller.sessionId,
            body,
          )
        },
      )
      .patch(
        '/account/email',
        {
          body: t.Object({
            email: t.String({ format: 'email' }),
            password: t.Optional(t.String()),
          }),
          response: AccountSchema,
          detail: { summary: 'Update account email', tags: ['account'] },
        },
        async ({ body, request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).updateEmail(userId, body)
        },
      )
      .patch(
        '/account/phone',
        {
          body: t.Object({
            phone: t.String({ minLength: 1 }),
            password: t.Optional(t.String()),
          }),
          response: AccountSchema,
          detail: { summary: 'Update account phone', tags: ['account'] },
        },
        async ({ body, request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).updatePhone(userId, body)
        },
      )
      .patch(
        '/account/status',
        {
          response: t.Object({ ok: t.Boolean() }),
          detail: { summary: 'Block own account', tags: ['account'] },
        },
        async ({ request }) => {
          const caller = getAuthUser(request)
          const userId = requireUserId(caller)
          await (await getAccountService(service, request)).blockOwn(userId, caller.sessionId)
          return { ok: true }
        },
      )

      // Sessions
      .post(
        '/account/sessions/email',
        {
          body: t.Object({
            email: t.String({ format: 'email' }),
            password: t.String(),
          }),
          response: SessionResponseSchema,
          detail: { summary: 'Create session with email', tags: ['account'] },
        },
        async ({ body, request }) =>
          (await getAccountService(service, request)).loginEmail(
            body.email,
            body.password,
            getReqMeta(request),
          ),
      )
      .post(
        '/account/sessions/anonymous',
        {
          response: SessionResponseSchema,
          detail: { summary: 'Create anonymous session', tags: ['account'] },
        },
        async ({ request }) =>
          (await getAccountService(service, request)).loginAnonymous(getReqMeta(request)),
      )
      .get(
        '/account/sessions',
        {
          response: t.Array(SessionResponseSchema),
          detail: { summary: 'List account sessions', tags: ['account'] },
        },
        async ({ request }) => {
          const caller = getAuthUser(request)
          const userId = requireUserId(caller)
          const sessSvc = await getSessionsService(sessionsService, request)
          if (!sessSvc) return []
          return sessSvc.list(userId, caller.sessionId)
        },
      )
      .delete(
        '/account/sessions',
        {
          response: t.Object({ ok: t.Boolean() }),
          detail: { summary: 'Delete all account sessions', tags: ['account'] },
        },
        async ({ request }) => {
          const caller = getAuthUser(request)
          const userId = requireUserId(caller)
          const sessSvc = await getSessionsService(sessionsService, request)
          if (sessSvc) {
            await sessSvc.deleteAll(userId)
          }
          return { ok: true }
        },
      )
      .get(
        '/account/sessions/:sessionId',
        {
          params: t.Object({ sessionId: t.String() }),
          response: SessionResponseSchema,
          detail: { summary: 'Get account session', tags: ['account'] },
        },
        async ({ params, request }) => {
          const caller = getAuthUser(request)
          const userId = requireUserId(caller)
          const targetId = params.sessionId === 'current' ? caller.sessionId : params.sessionId
          const sessSvc = await getSessionsService(sessionsService, request)
          if (!targetId || !sessSvc) {
            throw new NotFoundError('Session not found', { code: 'user_session_not_found' })
          }
          const sess = await sessSvc.get(targetId, caller.sessionId)
          if (sess.userId !== userId) {
            throw new NotFoundError('Session not found', { code: 'user_session_not_found' })
          }
          return sess
        },
      )
      .delete(
        '/account/sessions/:sessionId',
        {
          params: t.Object({ sessionId: t.String() }),
          response: t.Object({ ok: t.Boolean() }),
          detail: { summary: 'Delete account session', tags: ['account'] },
        },
        async ({ params, request }) => {
          const caller = getAuthUser(request)
          const userId = requireUserId(caller)
          const targetId = params.sessionId === 'current' ? caller.sessionId : params.sessionId
          const sessSvc = await getSessionsService(sessionsService, request)
          if (!targetId || !sessSvc) {
            throw new NotFoundError('Session not found', { code: 'user_session_not_found' })
          }
          const sess = await sessSvc.get(targetId, caller.sessionId)
          if (sess.userId !== userId) {
            throw new NotFoundError('Session not found', { code: 'user_session_not_found' })
          }
          await sessSvc.delete(targetId)
          return { ok: true }
        },
      )

      // Tokens / JWT
      .post(
        '/account/tokens/jwt',
        {
          body: t.Optional(
            t.Object({
              sessionId: t.Optional(t.String()),
              duration: t.Optional(t.Integer({ minimum: 60, maximum: 3600, default: 900 })),
            }),
          ),
          response: t.Object({ jwt: t.String() }),
          detail: { summary: 'Mint short-lived JWT', tags: ['account'] },
        },
        async ({ body, request }) => {
          const caller = getAuthUser(request)
          const userId = requireUserId(caller)
          const targetSessionId = body?.sessionId ?? caller.sessionId ?? ''
          return (await getAccountService(service, request)).mintJwt(
            userId,
            targetSessionId,
            jwtSecret,
            body?.duration,
          )
        },
      )

      // Verifications
      .post(
        '/account/verifications/email',
        {
          body: t.Optional(t.Object({ url: t.Optional(t.String()) })),
          response: t.Object({
            $id: t.String(),
            secret: t.String(),
            url: t.Optional(t.String()),
          }),
          detail: { summary: 'Create email verification token', tags: ['account'] },
        },
        async ({ body, request }) => {
          const userId = requireUserId(getAuthUser(request))
          const res = await (await getAccountService(service, request)).createEmailVerification(
            userId,
            body?.url,
            getReqMeta(request),
          )
          return {
            $id: res.token.getId(),
            secret: res.secret,
            url: res.url,
          }
        },
      )
      .put(
        '/account/verifications/email',
        {
          body: t.Object({
            userId: t.String(),
            secret: t.String(),
          }),
          response: AccountSchema,
          detail: { summary: 'Confirm email verification', tags: ['account'] },
        },
        async ({ body, request }) =>
          (await getAccountService(service, request)).confirmEmailVerification(
            body.userId,
            body.secret,
          ),
      )
      .post(
        '/account/verifications/phone',
        {
          response: t.Object({
            $id: t.String(),
            secret: t.String(),
          }),
          detail: { summary: 'Create phone verification token (OTP)', tags: ['account'] },
        },
        async ({ request }) => {
          const userId = requireUserId(getAuthUser(request))
          const res = await (await getAccountService(service, request)).createPhoneVerification(
            userId,
            getReqMeta(request),
          )
          return {
            $id: res.token.getId(),
            secret: res.secret,
          }
        },
      )
      .put(
        '/account/verifications/phone',
        {
          body: t.Object({
            userId: t.String(),
            secret: t.String(),
          }),
          response: AccountSchema,
          detail: { summary: 'Confirm phone verification', tags: ['account'] },
        },
        async ({ body, request }) =>
          (await getAccountService(service, request)).confirmPhoneVerification(
            body.userId,
            body.secret,
          ),
      )

      // Recovery
      .post(
        '/account/recovery',
        {
          body: t.Object({
            email: t.String({ format: 'email' }),
            url: t.String(),
          }),
          response: t.Object({
            userId: t.String(),
            secret: t.String(),
            expire: t.String(),
          }),
          detail: { summary: 'Create password recovery token', tags: ['account'] },
        },
        async ({ body, request }) => {
          const res = await (await getAccountService(service, request)).createPasswordRecovery(
            body.email,
            body.url,
            getReqMeta(request),
          )
          return {
            userId: res.userId,
            secret: res.secret,
            expire: res.expire,
          }
        },
      )
      .put(
        '/account/recovery',
        {
          body: t.Object({
            userId: t.String(),
            secret: t.String(),
            password: t.String({ minLength: 8 }),
          }),
          response: AccountSchema,
          detail: { summary: 'Confirm recovery (reset password)', tags: ['account'] },
        },
        async ({ body, request }) =>
          (await getAccountService(service, request)).confirmPasswordRecovery(
            body.userId,
            body.secret,
            body.password,
          ),
      )

      // Identities
      .get(
        '/account/identities',
        {
          response: t.Array(IdentitySchema),
          detail: { summary: 'List OAuth2 identities', tags: ['account'] },
        },
        async ({ request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).listIdentities(userId)
        },
      )
      .delete(
        '/account/identities/:identityId',
        {
          params: t.Object({ identityId: t.String() }),
          response: t.Object({ ok: t.Boolean() }),
          detail: { summary: 'Unlink an identity', tags: ['account'] },
        },
        async ({ params, request }) => {
          const userId = requireUserId(getAuthUser(request))
          await (await getAccountService(service, request)).deleteIdentity(
            userId,
            params.identityId,
          )
          return { ok: true }
        },
      )

      // Targets
      .post(
        '/account/targets/push',
        {
          body: t.Object({
            targetId: t.Optional(t.String()),
            identifier: t.String(),
            providerId: t.Optional(t.String()),
          }),
          response: TargetSchema,
          detail: { summary: 'Register push target for current session', tags: ['account'] },
        },
        async ({ body, request }) => {
          const caller = getAuthUser(request)
          const userId = requireUserId(caller)
          return (await getAccountService(service, request)).createPushTarget(
            userId,
            caller.sessionId,
            body,
          )
        },
      )
      .put(
        '/account/targets/:targetId/push',
        {
          params: t.Object({ targetId: t.String() }),
          body: t.Object({ identifier: t.String() }),
          response: TargetSchema,
          detail: { summary: 'Update push target identifier', tags: ['account'] },
        },
        async ({ params, body, request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).updatePushTarget(
            userId,
            params.targetId,
            body,
          )
        },
      )
      .delete(
        '/account/targets/:targetId/push',
        {
          params: t.Object({ targetId: t.String() }),
          response: t.Object({ ok: t.Boolean() }),
          detail: { summary: 'Delete push target', tags: ['account'] },
        },
        async ({ params, request }) => {
          const userId = requireUserId(getAuthUser(request))
          await (await getAccountService(service, request)).deletePushTarget(
            userId,
            params.targetId,
          )
          return { ok: true }
        },
      )

      // MFA
      .patch(
        '/account/mfa',
        {
          body: t.Object({ mfa: t.Boolean() }),
          response: t.Object({ ok: t.Boolean() }),
          detail: { summary: 'Enable or disable MFA', tags: ['account'] },
        },
        async ({ body, request }) => {
          const caller = getAuthUser(request)
          const userId = requireUserId(caller)
          await (await getAccountService(service, request)).updateMfa(
            userId,
            body.mfa,
            caller.sessionId,
          )
          return { ok: true }
        },
      )
      .get(
        '/account/mfa/factors',
        {
          response: MfaFactorsSchema,
          detail: { summary: 'List MFA factors', tags: ['account'] },
        },
        async ({ request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).getMfaFactors(userId)
        },
      )
      .post(
        '/account/mfa/authenticators/totp',
        {
          response: t.Object({ secret: t.String(), uri: t.String() }),
          detail: { summary: 'Create TOTP authenticator', tags: ['account'] },
        },
        async ({ request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).createTotpAuthenticator(userId)
        },
      )
      .put(
        '/account/mfa/authenticators/totp',
        {
          body: t.Object({ otp: t.String({ minLength: 6, maxLength: 6 }) }),
          response: t.Object({ ok: t.Boolean() }),
          detail: { summary: 'Verify TOTP authenticator', tags: ['account'] },
        },
        async ({ body, request }) => {
          const caller = getAuthUser(request)
          const userId = requireUserId(caller)
          await (await getAccountService(service, request)).verifyTotpAuthenticator(
            userId,
            body.otp,
            caller.sessionId,
          )
          return { ok: true }
        },
      )
      .delete(
        '/account/mfa/authenticators/totp',
        {
          response: t.Object({ ok: t.Boolean() }),
          detail: { summary: 'Delete TOTP authenticator', tags: ['account'] },
        },
        async ({ request }) => {
          const userId = requireUserId(getAuthUser(request))
          await (await getAccountService(service, request)).deleteTotpAuthenticator(userId)
          return { ok: true }
        },
      )
      .patch(
        '/account/mfa/recovery-codes',
        {
          response: t.Object({ recoveryCodes: t.Array(t.String()) }),
          detail: { summary: 'Create recovery codes', tags: ['account'] },
        },
        async ({ request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).createRecoveryCodes(userId)
        },
      )
      .put(
        '/account/mfa/recovery-codes',
        {
          response: t.Object({ recoveryCodes: t.Array(t.String()) }),
          detail: { summary: 'Regenerate recovery codes', tags: ['account'] },
        },
        async ({ request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).updateRecoveryCodes(userId)
        },
      )
      .get(
        '/account/mfa/recovery-codes',
        {
          response: t.Object({ recoveryCodes: t.Array(t.String()) }),
          detail: { summary: 'Get recovery codes', tags: ['account'] },
        },
        async ({ request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).getRecoveryCodes(userId)
        },
      )
      .post(
        '/account/mfa/challenge',
        {
          body: t.Object({
            factor: t.Union([
              t.Literal('email'),
              t.Literal('phone'),
              t.Literal('totp'),
              t.Literal('recoveryCode'),
            ]),
          }),
          response: t.Object({ challengeId: t.String() }),
          detail: { summary: 'Create MFA challenge', tags: ['account'] },
        },
        async ({ body, request }) => {
          const userId = requireUserId(getAuthUser(request))
          return (await getAccountService(service, request)).createMfaChallenge(userId, body.factor)
        },
      )
      .put(
        '/account/mfa/challenge',
        {
          body: t.Object({
            challengeId: t.String(),
            otp: t.String(),
          }),
          response: t.Object({ ok: t.Boolean() }),
          detail: { summary: 'Verify MFA challenge', tags: ['account'] },
        },
        async ({ body, request }) => {
          const caller = getAuthUser(request)
          const userId = requireUserId(caller)
          await (await getAccountService(service, request)).verifyMfaChallenge(
            userId,
            body.challengeId,
            body.otp,
            caller.sessionId,
          )
          return { ok: true }
        },
      )
  )
}
