/**
 * Console auth enforcement — every platform route requires a valid,
 * unexpired console access JWT (`Authorization: Bearer`), except the
 * health probe and the auth endpoints themselves.
 *
 * Bearer-in-header is the CLI-compatible shape (tokens live in the
 * CLI's config file); the console UI uses the same header from memory.
 *
 * NOTE (elysia@2.0.0-beta.6): route-scoped lifecycle hooks registered
 * from a function-style plugin apply to the consuming instance's routes
 * (same pattern as `rateLimit` in apps/server). The beta does not
 * expose route metadata to hooks, so public-path skipping is by
 * request-path prefix — the platform surface is small and fixed.
 */

import { verifyJwt } from '@nuvix/core/auth'
import { UnauthorizedError } from '@nuvix/core/errors'
import type { Elysia } from 'elysia'
import { CONSOLE_JWT_AUDIENCE } from '../modules/auth/service'

/** Paths reachable without a console access token. */
const PUBLIC_PATHS = new Set(['/health'])

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  // Auth endpoints (login/refresh/logout) are public; everything under
  // /console/auth is intentionally reachable pre-auth.
  return pathname === '/console/auth' || pathname.startsWith('/console/auth/')
}

export interface ConsoleJwtClaims {
  id: string
  email: string
}

/**
 * Registers console auth enforcement on the consuming instance.
 * Throws `UnauthorizedError` (mapped to problem+json 401 by
 * `problemErrors`) for missing/invalid/expired tokens.
 */
export function consoleAuth(options: { secret: string }): (app: Elysia) => Elysia {
  return (app) =>
    app.derive(async (ctx) => {
      const { request } = ctx
      const url = new URL(request.url)
      if (isPublicPath(url.pathname)) {
        return {}
      }

      const header = request.headers.get('authorization') ?? ''
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
      if (!token) {
        throw new UnauthorizedError('Missing bearer token', {
          code: 'console_unauthorized',
        })
      }

      const payload = await verifyJwt(token, options.secret)
      if (!payload || payload.aud !== CONSOLE_JWT_AUDIENCE || !payload.sub) {
        throw new UnauthorizedError('Invalid or expired token', {
          code: 'console_unauthorized',
        })
      }

      // Attached for handlers/auditing; enforcement is the primary job.
      return {
        consoleUser: {
          id: String(payload.sub),
          email: String(payload.email ?? ''),
        } satisfies ConsoleJwtClaims,
      }
    })
}
