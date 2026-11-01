/** Resolves request authentication from sessions, JWTs, and API keys with optional stateful verifiers. */
import { Elysia } from 'elysia'
import { HEADERS } from '../shared/constants'
import { verifyJwt } from '../utils/jwt'

export type AuthMode = 'admin' | 'console'

export type AuthContext =
  | { type: 'guest' }
  | { type: 'session'; sessionId: string; userId: string }
  | { type: 'jwt'; userId: string; sessionId?: string }
  | { type: 'apiKey'; keyId: string; mode: AuthMode }

/** Optional stateful checks; absent verifiers leave the request unauthenticated. */
export interface AuthVerifiers {
  verifySession?: (sessionId: string) => Promise<{ userId: string } | null>
  verifyApiKey?: (key: string, mode: AuthMode) => Promise<{ keyId: string } | null>
}

function parseMode(value: string | null): AuthMode {
  return value === 'console' ? 'console' : 'admin'
}

export async function resolveAuth(
  headers: Headers,
  verifiers: AuthVerifiers = {},
  jwtSecret?: string,
): Promise<AuthContext> {
  // Session credentials are checked before stateless bearer credentials.
  const sessionId = headers.get(HEADERS.session)
  if (sessionId) {
    if (!verifiers.verifySession) return { type: 'guest' }
    const session = await verifiers.verifySession(sessionId)
    return session ? { type: 'session', sessionId, userId: session.userId } : { type: 'guest' }
  }

  // Short-lived JWT credentials.
  const token = headers.get(HEADERS.jwt)
  if (token && jwtSecret) {
    const payload = await verifyJwt(token, jwtSecret)
    // Audience separation: console (platform) JWTs must never
    // authenticate as tenant users on the project-facing server.
    if (payload?.aud === 'console') return { type: 'guest' }
    if (payload?.sub) {
      return {
        type: 'jwt',
        userId: payload.sub,
        sessionId: typeof payload.sid === 'string' ? payload.sid : undefined,
      }
    }
    return { type: 'guest' }
  }

  // Tenant API-key credentials and their optional mode.
  const apiKey = headers.get(HEADERS.apiKey)
  if (apiKey) {
    const mode = parseMode(headers.get(HEADERS.mode))
    if (!verifiers.verifyApiKey) return { type: 'guest' }
    const key = await verifiers.verifyApiKey(apiKey, mode)
    return key ? { type: 'apiKey', keyId: key.keyId, mode } : { type: 'guest' }
  }

  return { type: 'guest' }
}

export function authContext(options: { jwtSecret?: string; verifiers?: AuthVerifiers } = {}) {
  return new Elysia({ name: 'auth-context' }).derive(
    // Plugin scope makes the resolved auth context available to downstream route plugins.
    'plugin',
    async ({ request }) => ({
      auth: await resolveAuth(request.headers, options.verifiers, options.jwtSecret),
    }),
  )
}
