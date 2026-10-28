/**
 * Exposes console login, token rotation, logout, and identity routes. Token pairs remain in the
 * response for CLI clients, while the refresh token is also available through an HttpOnly cookie.
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

// Prefer an explicit body token for CLI calls, then fall back to the browser's refresh cookie.
function refreshFrom(headers: Record<string, unknown>, body?: { refreshToken?: string }): string {
  return (
    body?.refreshToken ??
    (typeof headers.cookie === 'string'
      ? (headers.cookie.match(new RegExp(`${REFRESH_COOKIE}=([^;]+)`))?.[1] ?? '')
      : '')
  )
}

// Keep the token response typed at the route boundary so clients receive one stable shape.
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

/** Binds console auth routes to an injected service so composition and tests share the same boundary. */
export function authRoutesFor(service: ConsoleAuthService) {
  return (
    new Elysia({ name: 'console-auth-routes' })
      // Login is the only route that accepts the operator's primary credentials.
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
            // Per-credential login throttling maps to a 429 with Retry-After.
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

      // Refresh rotates the credential pair and invalidates the presented refresh token.
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

      // Logout revokes the session associated with the supplied refresh token.
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

      // The identity route is protected by the upstream consoleAuth plugin.
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
          // Read the user derived by consoleAuth across the Elysia composition boundary.
          const consoleUser =
            'consoleUser' in ctx ? (ctx as { consoleUser: { id: string } }).consoleUser : undefined
          return service.getMe(consoleUser?.id ?? '')
        },
      )
  )
}
