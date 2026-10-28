/**
 * Implements platform-operator authentication for the console and CLI. Access tokens are short-lived
 * JWTs, while refresh tokens are opaque credentials stored only as hashes and rotated on every use.
 */

import { createHash, randomBytes } from 'node:crypto'
import { Auth, signJwt } from '@nuvix/core/auth'
import { type Database, Doc, Query } from '@nuvix/db'
import { config } from '@nuvix/utils'
import { UnauthorizedError } from '../../shared/errors'

/** Access-token TTL seconds (env override; default 15 minutes). */
export const CONSOLE_ACCESS_TTL_SECONDS = Number.parseInt(
  process.env.NUVIX_CONSOLE_ACCESS_TTL ?? '900',
  10,
)

/** Refresh-token TTL seconds (env override; default 90 days). */
export const CONSOLE_REFRESH_TTL_SECONDS =
  Number.parseInt(process.env.NUVIX_CONSOLE_REFRESH_TTL_DAYS ?? '90', 10) * 86_400

/** JWT audience restricting these tokens to the console surface. */
export const CONSOLE_JWT_AUDIENCE = 'console'

/** Safe console-user projection for API responses. */
export interface ConsoleUserView {
  $id: string
  email: string
  name: string | null
}

/** The token pair returned by login and refresh. */
export interface ConsoleTokenPair {
  accessToken: string
  refreshToken: string
  /** Access-token lifetime in seconds. */
  expiresIn: number
  user: ConsoleUserView
}

/** sha256 hex of a refresh token — the only stored representation. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Creates the opaque credential used to renew a console access token. */
export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

function toUserView(doc: Doc): ConsoleUserView {
  return {
    $id: doc.getId(),
    email: String(doc.get('email') ?? ''),
    name: doc.get('name') ? String(doc.get('name')) : null,
  }
}

/** Any-typed platform record (console users carry arbitrary fields). */
// biome-ignore lint/suspicious/noExplicitAny: dynamic platform records
type AnyDoc = Doc<any>

/**
 * Limits repeated failures per email and client key within one process. A shared store is required
 * when multiple platform instances must enforce the same lockout window.
 */
const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60 * 1000

const failureCounts = new Map<string, { count: number; windowStart: number }>()

export class LoginThrottledError extends Error {
  readonly retryAfterSeconds: number
  constructor(retryAfterSeconds: number) {
    super('Too many failed login attempts')
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function throttleKey(email: string, clientKey: string): string {
  return `${email.toLowerCase()}|${clientKey}`
}

function assertNotThrottled(key: string): void {
  const entry = failureCounts.get(key)
  if (!entry) return
  if (Date.now() - entry.windowStart > WINDOW_MS) {
    failureCounts.delete(key)
    return
  }
  if (entry.count >= MAX_FAILURES) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + WINDOW_MS - Date.now()) / 1000)
    throw new LoginThrottledError(retryAfterSeconds)
  }
}

function recordFailure(key: string): void {
  const entry = failureCounts.get(key)
  if (!entry || Date.now() - entry.windowStart > WINDOW_MS) {
    failureCounts.set(key, { count: 1, windowStart: Date.now() })
    return
  }
  entry.count += 1
}

function resetFailures(key: string): void {
  failureCounts.delete(key)
}

export class ConsoleAuthService {
  constructor(private readonly db: Database) {}

  private system() {
    return this.db.system()
  }

  /**
   * Email + password login. Constant responses for unknown emails and
   * wrong passwords (no user enumeration). Creates the session row and
   * returns a fresh token pair.
   */
  async login(
    email: string,
    password: string,
    userAgent?: string,
    clientKey = '',
  ): Promise<ConsoleTokenPair> {
    const normalizedEmail = email.trim().toLowerCase()
    const key = throttleKey(normalizedEmail, clientKey)
    assertNotThrottled(key)

    const user = await this.system().findOne('console_users', (query) =>
      query.equal('email', normalizedEmail),
    )

    const passwordOk = user.empty()
      ? false
      : await Auth.passwordVerify(password, String(user.get('passwordHash') ?? ''))
    if (!passwordOk) {
      // Keep unknown-email and wrong-password responses indistinguishable.
      recordFailure(key)
      throw new UnauthorizedError('Invalid email or password', {
        code: 'console_invalid_credentials',
      })
    }
    resetFailures(key)

    const pair = await this.createSession(user, userAgent)
    return { ...pair, user: toUserView(user) }
  }

  /**
   * Rotating refresh: validates the presented token, mints a fresh pair,
   * and moves the old hash to `previousHash`. Re-presenting a rotated
   * (previous) token revokes the whole session — evidence of theft.
   */
  async refresh(refreshToken: string, userAgent?: string): Promise<ConsoleTokenPair> {
    const presentedHash = hashRefreshToken(refreshToken)
    const session = await this.system().findOne('console_sessions', (query) =>
      query.equal('refreshHash', presentedHash),
    )

    if (session.empty()) {
      // A missing current-token match may indicate revocation or reuse; inspect previousHash next.
      await this.revokeByPreviousHash(presentedHash)
      throw new UnauthorizedError('Invalid or expired refresh token', {
        code: 'console_invalid_refresh_token',
      })
    }

    const expireAt = new Date(String(session.get('expireAt'))).getTime()
    if (!Number.isFinite(expireAt) || expireAt <= Date.now()) {
      await this.system().deleteDocument('console_sessions', session.getId())
      throw new UnauthorizedError('Invalid or expired refresh token', {
        code: 'console_invalid_refresh_token',
      })
    }

    const user = await this.system().getDocument('console_users', String(session.get('userId')))
    if (user.empty()) {
      await this.system().deleteDocument('console_sessions', session.getId())
      throw new UnauthorizedError('Invalid or expired refresh token', {
        code: 'console_invalid_refresh_token',
      })
    }

    // Replace the current hash while retaining the old one for reuse detection.
    const nextToken = newRefreshToken()
    session.set('previousHash', presentedHash)
    session.set('refreshHash', hashRefreshToken(nextToken))
    session.set('expireAt', new Date(Date.now() + CONSOLE_REFRESH_TTL_SECONDS * 1000))
    if (userAgent) session.set('userAgent', userAgent)
    await this.system().updateDocument('console_sessions', session.getId(), session)

    const accessToken = await signJwt(
      {
        sub: user.getId(),
        email: String(user.get('email')),
        aud: CONSOLE_JWT_AUDIENCE,
      },
      config.jwtSecret,
      CONSOLE_ACCESS_TTL_SECONDS,
    )

    return {
      accessToken,
      refreshToken: nextToken,
      expiresIn: CONSOLE_ACCESS_TTL_SECONDS,
      user: toUserView(user),
    }
  }

  /**
   * Revoke the session bound to a refresh token (logout). Idempotent —
   * unknown tokens succeed silently.
   */
  async logout(refreshToken: string): Promise<void> {
    const session = await this.system().findOne('console_sessions', (query) =>
      query.equal('refreshHash', hashRefreshToken(refreshToken)),
    )
    if (!session.empty()) {
      await this.system().deleteDocument('console_sessions', session.getId())
    }
  }

  /** Fresh operator profile for `GET /console/me` (JWT-verified id). */
  async getMe(userId: string): Promise<ConsoleUserView> {
    const user = await this.system().getDocument('console_users', userId)
    if (user.empty()) {
      throw new UnauthorizedError('Operator not found', {
        code: 'console_unauthorized',
      })
    }
    return toUserView(user)
  }

  /** Removes a session when a rotated-away refresh token is presented again. */
  private async revokeByPreviousHash(presentedHash: string): Promise<void> {
    const rows = await this.system().find('console_sessions', [
      Query.equal('previousHash', [presentedHash]),
      Query.limit(1),
    ])
    for (const row of rows) {
      await this.system().deleteDocument('console_sessions', row.getId())
    }
  }

  /** Persists the initial refresh hash and mints its corresponding access token. */
  private async createSession(
    user: AnyDoc,
    userAgent?: string,
  ): Promise<Omit<ConsoleTokenPair, 'user'>> {
    const refreshToken = newRefreshToken()
    await this.system().createDocument(
      'console_sessions',
      new Doc({
        userId: user.getId(),
        refreshHash: hashRefreshToken(refreshToken),
        previousHash: null,
        userAgent: userAgent ?? null,
        expireAt: new Date(Date.now() + CONSOLE_REFRESH_TTL_SECONDS * 1000),
      }),
    )

    const accessToken = await signJwt(
      {
        sub: user.getId(),
        email: String(user.get('email')),
        aud: CONSOLE_JWT_AUDIENCE,
      },
      config.jwtSecret,
      CONSOLE_ACCESS_TTL_SECONDS,
    )

    return {
      accessToken,
      refreshToken,
      expiresIn: CONSOLE_ACCESS_TTL_SECONDS,
    }
  }
}

/** Seeds the first console operator once when the required bootstrap credentials are configured. */
export async function bootstrapConsoleUser(db: Database): Promise<void> {
  const email = process.env.NUVIX_CONSOLE_EMAIL?.trim().toLowerCase()
  const password = process.env.NUVIX_CONSOLE_PASSWORD
  if (!email || !password) return

  const system = db.system()
  const existing = await system.findOne('console_users', (query) => query.equal('email', email))
  if (!existing.empty()) return

  const passwordHash = await Auth.passwordHash(password)
  await system.createDocument(
    'console_users',
    new Doc({
      email,
      name: process.env.NUVIX_CONSOLE_NAME ?? 'Operator',
      passwordHash,
    }),
  )
  // eslint-disable-next-line no-console -- startup log
  console.log(`[nuvix] console operator seeded: ${email}`)
}
