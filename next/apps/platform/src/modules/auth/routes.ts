/**
 * Console auth routes — login, rotating refresh, logout, and the `me`
 * sanity probe (also the CLI's `whoami`). Token pairs are returned in
 * the body (CLI-friendly); the refresh token is additionally set as an
 * httpOnly cookie so a browser console can adopt cookie-based refresh
 * without a protocol change.
 */

import { TooManyRequestsError } from '@nuvix/core/errors'
import { Elysia, t } from 'elysia'
import type { ConsoleAuthService } from './service'
import { LoginThrottledError } from './service'

const REFRESH_COOKIE = 'nx_console_refresh'
const REFRESH_COOKIE_MAX_AGE = 90 * 86_400

function refreshCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : ''
  return `${REFRESH_COOKIE}=${token}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${REFRESH_COOKIE_MAX_AGE}`
}

function clearRefreshCookie(): string {
  return `${REFRESH_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
}

function refreshFrom(headers: Record<string, unknown>, body?: { refreshToken?: string }): string {
  return (
    body?.refreshToken ??
    (typeof headers.cookie === 'string'
      ? (headers.cookie.match(new RegExp(`${REFRESH_COOKIE}=([^;]+)`))?.[1] ?? '')
      : '')
  )
}

const TokenPairSchema = t.Object({
  accessToken: t.String(),
  refreshToken: t.String(),
  expiresIn: t.Number(),
  user: t.Object({
    $id: t.String(),
    email: t.String(),
    name: t.Nullable(t.String()),
  }),
})

/**
 * Wires the routes against a provided service (app composition) — kept
 * separate so tests can inject an in-memory-backed service.
 */
export function authRoutesFor(service: ConsoleAuthService) {
  return (
    new Elysia({ name: 'console-auth-routes' })
      // Login — the only credential-bearing endpoint.
      .post(
        '/console/auth',
        {
          detail: {
            summary: 'Console login',
            description:
              'Exchange operator credentials for an access/refresh token pair. The access token is a short-lived JWT (Authorization: Bearer); the refresh token is opaque, rotated on every refresh, and additionally set as an httpOnly cookie for browser clients.',
            tags: ['Console Auth'],
          },
          body: t.Object({
            email: t.String({ format: 'email', description: 'Operator email' }),
            password: t.String({
              minLength: 1,
              description: 'Operator password',
            }),
          }),
          response: TokenPairSchema,
        },
        async ({ body, headers, set, request }) => {
          const clientKey =
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            request.headers.get('x-real-ip') ??
            ''
          try {
            const pair = await service.login(
              body.email,
              body.password,
              typeof headers['user-agent'] === 'string' ? headers['user-agent'] : undefined,
              clientKey,
            )
            set.headers['Set-Cookie'] = refreshCookie(pair.refreshToken)
            return pair
          } catch (error) {
            // Hardening pass: per-credential login throttling.
            if (error instanceof LoginThrottledError) {
              set.headers['retry-after'] = String(error.retryAfterSeconds)
              throw new TooManyRequestsError(
                `Too many failed login attempts — retry in ${error.retryAfterSeconds}s`,
                { code: 'console_login_throttled' },
              )
            }
            throw error
          }
        },
      )

      // Refresh — rotating; the previous token becomes unusable.
      .post(
        '/console/auth/refresh',
        {
          detail: {
            summary: 'Refresh console tokens',
            description:
              'Exchange the current refresh token for a fresh pair. Rotation: the presented token is invalidated immediately; re-presenting it revokes the whole session (theft detection). Accepts the httpOnly cookie when the body token is omitted.',
            tags: ['Console Auth'],
          },
          body: t.Optional(
            t.Object({
              refreshToken: t.Optional(t.String({ description: 'Current refresh token' })),
            }),
          ),
          response: TokenPairSchema,
        },
        async ({ body, headers, set }) => {
          const pair = await service.refresh(
            refreshFrom(headers, body ?? undefined),
            typeof headers['user-agent'] === 'string' ? headers['user-agent'] : undefined,
          )
          set.headers['Set-Cookie'] = refreshCookie(pair.refreshToken)
          return pair
        },
      )

      // Logout — revokes the session bound to the refresh token.
      .post(
        '/console/auth/logout',
        {
          detail: {
            summary: 'Console logout',
            description:
              'Revoke the session bound to the given refresh token. Idempotent for unknown tokens.',
            tags: ['Console Auth'],
          },
          body: t.Optional(
            t.Object({
              refreshToken: t.Optional(t.String({ description: 'Refresh token to revoke' })),
            }),
          ),
        },
        async ({ body, headers, set }) => {
          await service.logout(refreshFrom(headers, body ?? undefined))
          set.headers['Set-Cookie'] = clearRefreshCookie()
          return { status: 'ok' as const }
        },
      )

      // Whoami — sanity probe; requires a valid access token (enforced by
      // the consoleAuth plugin).
      .get(
        '/console/me',
        {
          detail: {
            summary: 'Console whoami',
            description:
              'Returns the operator bound to the presented access token. The CLI uses this as its `whoami`.',
            tags: ['Console Auth'],
          },
          response: t.Object({
            $id: t.String(),
            email: t.String(),
            name: t.Nullable(t.String()),
          }),
        },
        (ctx) => {
          // consoleAuth (composed upstream) derives `consoleUser`; the
          // cast-derive pattern reaches it across the .use() boundary.
          const consoleUser =
            'consoleUser' in ctx ? (ctx as { consoleUser: { id: string } }).consoleUser : undefined
          return service.getMe(consoleUser?.id ?? '')
        },
      )
  )
}
