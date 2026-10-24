/**
 * Account OAuth2 flows — v2 port of legacy
 * `apps/server/src/account/sessions/session.service.ts` OAuth2 surface.
 *
 * Flow (v1 parity):
 *  1. `GET /account/sessions/oauth2/:provider` → 302 to the provider
 *     authorize URL; state carries success/failure + the token flag.
 *  2. `GET|POST /account/sessions/oauth2/:provider/callback` → provider
 *     calls back with `code` (+`state`). The flow validates state, exchanges
 *     the code, resolves/creates/links the user + identity, replaces any
 *     current session (session upgrade), then:
 *     - session flow: creates a DB session, sets the httpOnly cookie
 *       (`nx_<name>`), and 302s to the success URL;
 *     - token flow (`state.token`): creates an OAUTH2-type token and returns
 *       `secret`/`userId` as success query params (non-cookie clients).
 *
 * Failures 302 to the state's `failure` URL with an `error` query param
 * (legacy shape: JSON `{message, type, code}`); without a failure URL the
 * error surfaces as a normal problem+json response.
 */

import { Auth } from '@nuvix/core/auth'
import {
  getOAuth2Provider,
  type OAuth2Provider,
  type RedirectRules,
  redirectRules,
  validateRedirectURL,
} from '@nuvix/core/oauth'
import type { ProjectRegistry } from '@nuvix/core/platform'
import { decodeEncryptionKey, decryptSecret } from '@nuvix/core/tenants'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import { config } from '@nuvix/utils'
import { AppError, BadRequestError } from '../../shared/errors'
import type {
  IdentitiesDoc,
  Sessions,
  SessionsDoc,
  Tokens,
  Users,
  UsersDoc,
} from '../../types/generated'
import { TokenType } from '../sessions/service'

export interface OAuthProviderConfig {
  key: string
  appId?: string
  secret?: string
  enabled?: boolean
}

export interface OAuth2BeginInput {
  provider: string
  success?: string
  failure?: string
  scopes?: string[]
  /** Base URL (scheme + host) of this Nuvix endpoint, e.g. `https://api.x.dev`. */
  baseUrl: string
}

export interface OAuth2CallbackInput {
  provider: string
  code?: string
  state?: string
  error?: string
  error_description?: string
  /** Apple's first-login profile blob (JSON with `name.firstName/lastName`). */
  user?: string
  baseUrl: string
}

/** The 302 result: where to send the browser + headers to apply. */
export interface OAuth2RedirectResult {
  location: string
  /** `Set-Cookie` header values (session flow only). */
  cookies: string[]
  headers: Record<string, string>
}

export interface OAuth2ServiceDeps {
  /** Tenant-local DB session (caller-scoped, per request). */
  db: Session
  /** Control-plane registry — reads provider configs, platforms, settings. */
  registry: ProjectRegistry
  /** Resolved platform project id (publishable-key selected). */
  projectId: string
  /** Platform encryption key (base64) — decrypts provider secrets. */
  encryptionKey?: string
  /** Current user/session (may be empty/guest). */
  user: Doc<Users>
  currentSession: Doc<Sessions>
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const

type StateInput = {
  success?: string
  failure?: string
  token?: boolean
  [key: string]: unknown
}

export class OAuth2Service {
  constructor(private readonly deps: OAuth2ServiceDeps) {}

  // ── Step 1: begin flow (login URL) ────────────────────────────────────────

  /**
   * Builds the provider authorize URL (session flow — `state.token = false`).
   * v1 parity: validates success/failure against project platforms, requires
   * the provider to exist, be enabled, and have credentials configured.
   */
  async beginSessionFlow(input: OAuth2BeginInput): Promise<OAuth2RedirectResult> {
    return this.begin(input, false)
  }

  /**
   * Token flow variant (`GET /account/tokens/oauth2/:provider`) — same checks
   * but the state carries `token: true`, so the callback returns query-param
   * credentials instead of a session cookie.
   */
  async beginTokenFlow(input: OAuth2BeginInput): Promise<OAuth2RedirectResult> {
    return this.begin(input, true)
  }

  private async begin(input: OAuth2BeginInput, token: boolean): Promise<OAuth2RedirectResult> {
    const rules = await this.redirectRules()

    const validate = (url: string | undefined, kind: 'success' | 'failure') => {
      if (!url) return
      const message = validateRedirectURL(url, rules)
      if (message) {
        throw new BadRequestError(message, {
          code: kind === 'success' ? 'project_invalid_success_url' : 'project_invalid_failure_url',
        })
      }
    }
    validate(input.success, 'success')
    validate(input.failure, 'failure')

    const provider = await this.resolveProviderConfig(input.provider)
    const finalSuccess = input.success || `${input.baseUrl}/auth/oauth2/success`
    const finalFailure = input.failure || `${input.baseUrl}/auth/oauth2/failure`

    const oauth2 = this.instantiate(input.provider, provider, {
      success: finalSuccess,
      failure: finalFailure,
      token,
    })

    return {
      location: oauth2.getLoginURL(),
      cookies: [],
      headers: { ...NO_STORE_HEADERS },
    }
  }

  // ── Step 2: callback (the actual login) ───────────────────────────────────

  /**
   * Handles the provider callback: state validation, code exchange, user +
   * identity resolution, session/token creation, cookie issuance.
   */
  async handleCallback(input: OAuth2CallbackInput): Promise<OAuth2RedirectResult> {
    const rules = await this.redirectRules()

    let state: Required<StateInput> = {
      success: '',
      failure: '',
      token: false,
    }
    if (input.state) {
      try {
        const parsed = JSON.parse(input.state) as StateInput
        state = {
          success: typeof parsed.success === 'string' ? parsed.success : '',
          failure: typeof parsed.failure === 'string' ? parsed.failure : '',
          token: Boolean(parsed.token),
        }
      } catch {
        throw new BadRequestError(
          'Failed to parse login state params as passed from OAuth2 provider',
          { code: 'general_bad_request' },
        )
      }
    }

    const validateState = (kind: 'success' | 'failure') => {
      const url = state[kind]
      if (!url) return
      // v2 fix (v1 bug): our own relay pages (`/auth/oauth2/{success,failure}`
      // on this server) are always valid targets — v1 validated them against
      // registered client platforms, which broke default flows whenever the
      // API host itself wasn't registered as a client platform.
      const relayPrefix = `${input.baseUrl}/auth/oauth2/`
      if (url.startsWith(relayPrefix)) return
      const message = validateRedirectURL(url, rules)
      if (message) {
        throw new BadRequestError(message, {
          code: kind === 'success' ? 'project_invalid_success_url' : 'project_invalid_failure_url',
        })
      }
    }
    validateState('success')
    validateState('failure')

    const failureRedirect = (
      code: string,
      message: string,
      status: number,
    ): OAuth2RedirectResult => {
      if (state.failure) {
        const failureUrl = new URL(state.failure)
        failureUrl.searchParams.set(
          'error',
          JSON.stringify({ message, type: `/errors/${code}`, code: status }),
        )
        return {
          location: failureUrl.toString(),
          cookies: [],
          headers: { ...NO_STORE_HEADERS },
        }
      }
      throw new OAuth2FlowError(code, message, status)
    }

    const provider = await this.resolveProviderConfig(input.provider)

    if (input.error) {
      const message = `The ${input.provider} OAuth2 provider returned an error: ${input.error}${
        input.error_description ? `: ${input.error_description}` : ''
      }`
      return failureRedirect('user_oauth2_provider_error', message, 424)
    }

    if (!input.code) {
      return failureRedirect(
        'user_oauth2_provider_error',
        'Missing OAuth2 code. Please contact the team for additional support.',
        424,
      )
    }

    const oauth2 = this.instantiate(input.provider, provider, {})

    let accessToken: string
    let refreshToken: string
    let accessTokenExpiry: number
    try {
      accessToken = await oauth2.getAccessToken(input.code)
      refreshToken = await oauth2.getRefreshToken(input.code)
      accessTokenExpiry = await oauth2.getAccessTokenExpiry(input.code)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown provider error'
      return failureRedirect(
        'user_oauth2_provider_error',
        `Failed to obtain access token. The ${input.provider} OAuth2 provider returned an error: ${message}`,
        424,
      )
    }

    const oauth2ID = await oauth2.getUserID(accessToken)
    if (!oauth2ID) {
      return failureRedirect('user_missing_id', 'OAuth provider did not return a user ID', 400)
    }

    let name = await oauth2.getUserName(accessToken)
    if (!name && input.user) {
      try {
        const userParam = JSON.parse(input.user) as {
          name?: { firstName?: string; lastName?: string }
        }
        if (userParam.name?.firstName && userParam.name?.lastName) {
          name = `${userParam.name.firstName} ${userParam.name.lastName}`
        }
      } catch {
        // Malformed provider profile blob — name stays empty
      }
    }

    const email = await oauth2.getUserEmail(accessToken)
    const db = this.deps.db
    const { user } = this.deps
    let sessionUpgrade = false

    if (!user.empty()) {
      const identityWithMatchingEmail = (await db.findOne('identities', [
        Query.equal('providerEmail', [email]),
        Query.notEqual('userInternalId', user.getSequence()),
      ])) as IdentitiesDoc
      if (!identityWithMatchingEmail.empty()) {
        return failureRedirect('user_already_exists', 'Account already exists', 409)
      }

      const userWithMatchingEmail = await db.find('users', [
        Query.equal('email', [email]),
        Query.notEqual('$id', user.getId()),
      ])
      if (userWithMatchingEmail.length > 0) {
        return failureRedirect('user_already_exists', 'Account already exists', 409)
      }

      sessionUpgrade = true
    }

    // Session upgrade: replace the caller's current session with the new one (v1 parity).
    const currentSession = this.deps.currentSession
    if (currentSession && !currentSession.empty() && currentSession.getId()) {
      const currentDocument = (await db.getDocument(
        'sessions',
        currentSession.getId(),
      )) as SessionsDoc
      if (!currentDocument.empty()) {
        await db.deleteDocument('sessions', currentDocument.getId())
        await db.purgeCachedDocument('users', user.getId())
      }
    }

    let resolved = user

    if (resolved.empty()) {
      // 1. Existing session for the same provider identity?
      const session = (await db.findOne('sessions', [
        Query.equal('provider', [input.provider]),
        Query.equal('providerUid', [oauth2ID]),
      ])) as SessionsDoc
      if (!session.empty()) {
        const foundUser = (await db.getDocument('users', session.get('userId'))) as UsersDoc
        if (!foundUser.empty()) resolved = foundUser
      }
    }

    if (resolved.empty() && email) {
      // 2. Existing user with the same email?
      const userWithEmail = (await db.findOne('users', [Query.equal('email', [email])])) as UsersDoc
      if (!userWithEmail.empty()) resolved = userWithEmail
    }

    if (resolved.empty()) {
      // 3. Existing identity for the same provider uid?
      const identity = (await db.findOne('identities', [
        Query.equal('provider', [input.provider]),
        Query.equal('providerUid', [oauth2ID]),
      ])) as IdentitiesDoc
      if (!identity.empty()) {
        const foundUser = (await db.getDocument('users', identity.get('userId'))) as UsersDoc
        if (!foundUser.empty()) resolved = foundUser
      }
    }

    if (resolved.empty()) {
      resolved = await this.createUser(email, name)
    }

    if (resolved.get('status') === false) {
      return failureRedirect('user_blocked', 'User is blocked', 401)
    }

    // Upsert the provider identity.
    let identity = (await db.findOne('identities', [
      Query.equal('userInternalId', [resolved.getSequence()]),
      Query.equal('provider', [input.provider]),
      Query.equal('providerUid', [oauth2ID]),
    ])) as IdentitiesDoc

    if (identity.empty()) {
      const identitiesWithMatchingEmail = (await db.find('identities', [
        Query.equal('providerEmail', [email]),
        Query.notEqual('userInternalId', resolved.getSequence()),
      ])) as IdentitiesDoc[]
      if (identitiesWithMatchingEmail.length > 0) {
        return failureRedirect(
          'general_bad_request',
          'An account with the same email already exists',
          400,
        )
      }

      identity = (await db.createDocument(
        'identities',
        new Doc({
          $id: ID.unique(),
          $permissions: [
            Permission.read(Role.any()),
            Permission.update(Role.user(resolved.getId())),
            Permission.delete(Role.user(resolved.getId())),
          ],
          userInternalId: resolved.getSequence(),
          userId: resolved.getId(),
          provider: input.provider,
          providerUid: oauth2ID,
          providerEmail: email,
          providerAccessToken: accessToken,
          providerRefreshToken: refreshToken,
          providerAccessTokenExpiry: new Date(Date.now() + accessTokenExpiry * 1000),
        }),
      )) as IdentitiesDoc
    } else {
      identity
        .set('providerAccessToken', accessToken)
        .set('providerRefreshToken', refreshToken)
        .set('providerAccessTokenExpiry', new Date(Date.now() + accessTokenExpiry * 1000))
      await db.updateDocument('identities', identity.getId(), identity)
    }

    // Backfill profile basics on first link (v1 parity).
    if (!resolved.get('email')) resolved.set('email', email)
    if (!resolved.get('name')) resolved.set('name', name)
    resolved.set('status', true)
    await db.updateDocument('users', resolved.getId(), resolved)

    const duration = await this.sessionDuration()
    const expire = new Date(Date.now() + duration * 1000)

    const parsedSuccess = new URL(state.success)
    const query = new URLSearchParams(parsedSuccess.search)
    const cookies: string[] = []

    if (state.token) {
      // Token flow: return userId + secret as query params (non-cookie clients).
      const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_OAUTH2)
      await db.createDocument(
        'tokens',
        new Doc<Tokens>({
          $id: ID.unique(),
          userId: resolved.getId(),
          userInternalId: resolved.getSequence(),
          type: TokenType.OAUTH2,
          secret: Auth.hash(secret),
          expire,
        }).set('$permissions', [
          Permission.read(Role.user(resolved.getId())),
          Permission.update(Role.user(resolved.getId())),
          Permission.delete(Role.user(resolved.getId())),
        ]),
      )

      query.set('secret', secret)
      query.set('userId', resolved.getId())
    } else {
      // Session flow: create the DB session and set the httpOnly cookie.
      const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION)
      const sessionDoc = new Doc<Sessions>({
        $id: ID.unique(),
        userId: resolved.getId(),
        userInternalId: resolved.getSequence(),
        provider: input.provider,
        providerUid: oauth2ID,
        providerAccessToken: accessToken,
        providerRefreshToken: refreshToken,
        providerAccessTokenExpiry: new Date(Date.now() + accessTokenExpiry * 1000),
        secret: Auth.hash(secret),
        factors: ['email', 'oauth2'],
        expire,
      })

      const created = (await db.createDocument(
        'sessions',
        sessionDoc.set('$permissions', [
          Permission.read(Role.user(resolved.getId())),
          Permission.update(Role.user(resolved.getId())),
          Permission.delete(Role.user(resolved.getId())),
        ]),
      )) as SessionsDoc

      cookies.push(this.sessionCookie(resolved.getId(), secret, expire, input.baseUrl))

      // v1 parity: the default relay success page receives the credential in
      // query params (the page forwards them to the opener window).
      if (parsedSuccess.pathname === '/auth/oauth2/success') {
        query.set('domain', config.cookie.domain ?? '')
        query.set('key', sessionCookieName())
        query.set('secret', encodeSessionToken(resolved.getId(), secret))
      }

      // Session upgrade: rebind push targets to the fresh session (v1 parity).
      if (sessionUpgrade) {
        const targets = (resolved.get('targets') ?? []) as Doc<{
          providerType?: string
        }>[]
        for (const target of targets) {
          if (target.get('providerType') !== 'push') continue
          target.set('sessionId', created.getId())
          target.set('sessionInternalId', created.getSequence())
          await db.updateDocument('targets', target.getId(), target)
        }
      }
    }

    await db.purgeCachedDocument('users', resolved.getId())

    parsedSuccess.search = query.toString()
    return {
      location: parsedSuccess.toString(),
      cookies,
      headers: { ...NO_STORE_HEADERS },
    }
  }

  // ── Session refresh: rotate the provider's access token (contract §PATCH) ──

  /**
   * Refreshes the upstream provider tokens stored on an OAuth2 session.
   * v2 fix for the v1 bug: updates `providerAccessToken` only, rotates
   * `providerRefreshToken` when the provider returns a new one (v1
   * overwrote the refresh token with the access token), and bumps the
   * expiry. No-op for non-OAuth2 sessions.
   */
  async refreshProviderSession(session: SessionsDoc): Promise<void> {
    const provider = session.get('provider')
    const refreshToken = session.get('providerRefreshToken')
    if (!provider || !refreshToken) return

    const config = await this.resolveProviderConfig(provider)
    const oauth2 = this.instantiate(provider, config, {})

    const tokens = await oauth2.refreshTokens(refreshToken)
    if (!tokens.access_token) return

    session.set('providerAccessToken', tokens.access_token)
    if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
      session.set('providerRefreshToken', tokens.refresh_token)
    }
    const expiresIn = typeof tokens.expires_in === 'number' ? tokens.expires_in : 0
    if (expiresIn > 0) {
      session.set('providerAccessTokenExpiry', new Date(Date.now() + expiresIn * 1000))
    }
    await this.deps.db.updateDocument('sessions', session.getId(), session)
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private instantiate(
    name: string,
    provider: OAuthProviderConfig & { decryptedSecret?: string },
    state: Record<string, unknown>,
    scopes: string[] = [],
  ): OAuth2Provider {
    const Ctor = getOAuth2Provider(name)
    return new Ctor(provider.appId ?? '', provider.decryptedSecret ?? '', '', state, scopes)
  }

  private async resolveProviderConfig(
    provider: string,
  ): Promise<OAuthProviderConfig & { decryptedSecret?: string }> {
    const providers = await this.deps.registry.getOAuthProviders(this.deps.projectId)
    const found = providers.find((p) => p.key === provider)
    if (!found) {
      throw new BadRequestError('Provider is not supported', {
        code: 'project_provider_unsupported',
      })
    }
    if (!found.enabled) {
      throw new ProviderDisabledError(
        'This provider is disabled. Please enable the provider from your console to continue.',
      )
    }
    if (!found.appId || !found.secret) {
      throw new ProviderDisabledError(
        'This provider is disabled. Please configure the provider app ID and app secret key from your console to continue.',
      )
    }

    let decryptedSecret = found.secret
    if (this.deps.encryptionKey) {
      try {
        decryptedSecret = await decryptSecret(
          found.secret,
          decodeEncryptionKey(this.deps.encryptionKey),
        )
      } catch {
        // Stored plaintext (no encryption key at write time) — use as-is.
      }
    }

    return { ...found, decryptedSecret }
  }

  private async redirectRules(): Promise<RedirectRules> {
    const platforms = await this.deps.registry.getPlatforms(this.deps.projectId)
    return redirectRules(this.deps.projectId, platforms)
  }

  /** `project.auths.duration` overrides the default session length (v1 parity). */
  private async sessionDuration(): Promise<number> {
    try {
      const auths = await this.deps.registry.getAuthSettings(this.deps.projectId)
      const duration = auths?.duration
      if (typeof duration === 'number' && duration > 0) return duration
    } catch {
      // Settings unavailable — fall through to the default
    }
    return Auth.TOKEN_EXPIRATION_LOGIN_LONG
  }

  /** `project.auths.limit` overrides the default user cap (v1 parity). */
  private async projectUserLimit(): Promise<number> {
    try {
      const auths = await this.deps.registry.getAuthSettings(this.deps.projectId)
      const limit = auths?.limit
      if (typeof limit === 'number' && limit >= 0) return limit
    } catch {
      // Settings unavailable — fall through to the default
    }
    return config.limits.users
  }

  /** Creates a first-time OAuth2 user (+ email target) — v1 parity. */
  private async createUser(email: string, name: string): Promise<UsersDoc> {
    if (!email) {
      throw new OAuth2FlowError('user_unauthorized', 'OAuth provider failed to return email.', 401)
    }

    const db = this.deps.db

    const identityWithMatchingEmail = (await db.findOne('identities', [
      Query.equal('providerEmail', [email]),
    ])) as IdentitiesDoc
    if (!identityWithMatchingEmail.empty()) {
      // An identity with the same email exists under a different provider —
      // never auto-link for security reasons (v1 parity).
      throw new OAuth2FlowError(
        'general_bad_request',
        'An account with the same email already exists',
        400,
      )
    }

    const limit = await this.projectUserLimit()
    if (limit > 0) {
      const total = await db.count('users', [], limit)
      if (total >= limit) {
        throw new OAuth2FlowError('user_count_exceeded', 'User limit exceeded', 400)
      }
    }

    try {
      const userId = ID.unique()
      const created = (await db.createDocument(
        'users',
        new Doc<Users>({
          $id: userId,
          $permissions: [
            Permission.read(Role.any()),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
          ],
          email,
          emailVerification: true,
          status: true,
          hash: Auth.DEFAULT_ALGO,
          hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
          registration: new Date(),
          reset: false,
          name,
          mfa: false,
          prefs: {},
          search: `${userId} ${email} ${name}`,
          accessedAt: new Date(),
        }),
      )) as UsersDoc

      await db.createDocument(
        'targets',
        new Doc({
          $permissions: [
            Permission.read(Role.user(created.getId())),
            Permission.update(Role.user(created.getId())),
            Permission.delete(Role.user(created.getId())),
          ],
          userId: created.getId(),
          userInternalId: created.getSequence(),
          providerType: 'email',
          identifier: email,
        }),
      )

      return created
    } catch (error) {
      if (error instanceof Error && error.name === 'DuplicateException') {
        throw new OAuth2FlowError('user_already_exists', 'Account already exists', 409)
      }
      throw error
    }
  }

  private sessionCookie(userId: string, secret: string, expire: Date, baseUrl: string): string {
    const secure = baseUrl.startsWith('https')
    const parts = [
      `${sessionCookieName()}=${encodeURIComponent(encodeSessionToken(userId, secret))}`,
      'Path=/',
      `Expires=${expire.toUTCString()}`,
      'HttpOnly',
      `SameSite=${config.cookie.sameSite}`,
    ]
    if (config.cookie.domain) parts.push(`Domain=${config.cookie.domain}`)
    if (secure) parts.push('Secure')
    return parts.join('; ')
  }
}

// ── Cookie/session token encoding (matches `context/tenant.ts` decode path) ──

export function sessionCookieName(): string {
  return `nx_${config.cookie.name}`
}

/**
 * Builds the provider-token refresher handed to `AccountSessionsService` —
 * one narrow capability, composed per request (tenant db + project id are
 * request-scoped; the registry and key come from app composition).
 */
export function createOAuth2Refresher(deps: {
  registry: ProjectRegistry
  encryptionKey?: string
  projectId: string
  db: Session
}): (session: SessionsDoc) => Promise<void> {
  return (session) =>
    new OAuth2Service({
      db: deps.db,
      registry: deps.registry,
      projectId: deps.projectId,
      encryptionKey: deps.encryptionKey,
      user: new Doc<Users>(),
      currentSession: new Doc<Sessions>(),
    }).refreshProviderSession(session)
}

/**
 * Encodes the session credential for cookies / query params: base64 JSON
 * `{id, secret}` — the same shape `Auth.decodeSession` (no key) parses in the
 * tenant context chain (legacy `Auth.encodeSession` format without AES).
 */
export function encodeSessionToken(userId: string, secret: string): string {
  return Buffer.from(JSON.stringify({ id: userId, secret })).toString('base64')
}

// ── Errors (mapped to problem+json by the shared error handler) ──────────────

class OAuth2FlowError extends AppError {
  constructor(code: string, detail: string, status: number) {
    super(status, { type: `/errors/${code}`, code, detail })
  }
}

export class ProviderDisabledError extends AppError {
  constructor(detail: string) {
    super(412, {
      type: '/errors/precondition-failed',
      code: 'project_provider_disabled',
      detail,
    })
  }
}
