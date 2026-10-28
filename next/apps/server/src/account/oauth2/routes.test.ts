/** Route-level OAuth2 coverage for authorization, callback, token refresh, and failure redirects. */

import { describe, expect, it } from 'bun:test'
import type { ProjectRegistry } from '@nuvix/core/platform'
import { Doc, type Session } from '@nuvix/db'
import { Translator } from '@nuvix/i18n'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import { accountRoutes } from '../route'
import { sessionCookieName } from './service'

// In-memory tenant session used to observe users, identities, sessions, and tokens.

const store = new Map<string, Map<string, Doc>>()
const getCollection = (name: string) => {
  let col = store.get(name)
  if (!col) {
    col = new Map()
    store.set(name, col)
  }
  return col
}

const matches = (doc: Doc, queries: Array<{ attribute?: string; values?: unknown[] }>) => {
  for (const q of queries) {
    const attr = q.attribute ?? (q as { $attribute?: string }).$attribute ?? ''
    if (q.values && q.values.length > 0) {
      const val = q.values[0]
      if (String(doc.get(attr)) !== String(val)) return false
    }
  }
  return true
}

const mockSession = {
  find: async (collection: string, queries: Array<Record<string, unknown>> = []) =>
    [...getCollection(collection).values()].filter((doc) => matches(doc, queries as never)),
  findOne: async (collection: string, queries: Array<Record<string, unknown>> = []) =>
    [...getCollection(collection).values()].find((doc) => matches(doc, queries as never)) ??
    new Doc({}),
  getDocument: async (collection: string, id: string) =>
    getCollection(collection).get(id) ?? new Doc({}),
  createDocument: async (collection: string, doc: Doc) => {
    if (!doc.getId()) doc.set('$id', `auto_${getCollection(collection).size + 1}`)
    doc.set('$sequence', getCollection(collection).size + 1)
    getCollection(collection).set(doc.getId(), doc)
    return doc
  },
  updateDocument: async (collection: string, id: string, doc: Doc) => {
    getCollection(collection).set(id, doc)
    return doc
  },
  deleteDocument: async (collection: string, id: string) => {
    getCollection(collection).delete(id)
    return true
  },
  count: async (collection: string) => getCollection(collection).size,
  purgeCachedDocument: async () => {},
} as unknown as Session

// Control-plane registry double supplying provider configuration and project settings.

const fakeRegistry = {
  getOAuthProviders: async () => [
    {
      key: 'google',
      appId: 'test-app-id',
      secret: 'test-app-secret',
      enabled: true,
    },
    { key: 'disabled', appId: 'a', secret: 's', enabled: false },
    { key: 'unconfigured', enabled: true },
  ],
  getPlatforms: async () => [{ type: 'web', hostname: 'app.example.com', key: null }],
  getAuthSettings: async () => ({ duration: 3600, limit: 100 }),
} as unknown as ProjectRegistry

// Google OAuth2 wire double; the application still executes the real provider code paths.

const PROFILE = {
  sub: 'google-user-1',
  email: 'oauth.user@example.com',
  email_verified: true,
  name: 'OAuth User',
}

const originalFetch = globalThis.fetch

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input)
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    const rawBody = typeof init?.body === 'string' ? init.body : (url.split('?')[1] ?? '')
    const body = new URLSearchParams(rawBody)
    if (body.get('grant_type') === 'refresh_token') {
      return Response.json({ access_token: 'at-1', expires_in: 3600 })
    }
    const code = body.get('code') ?? ''
    if (code === 'good-code') {
      return Response.json({
        access_token: 'at-1',
        refresh_token: 'rt-1',
        expires_in: 3600,
      })
    }
    return Response.json({ error: 'invalid_grant' }, { status: 400 })
  }
  if (url.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) {
    return Response.json(PROFILE)
  }
  return originalFetch(input as never, init)
}) as typeof fetch

// Compose the account application with the mocked tenant context and provider registry.

const currentUser = new Doc({})
const currentSession = new Doc({})

const testApp = new Elysia()
  .use(
    problemErrors({
      getTranslator: async () => new Translator('en', 'en', { primary: {}, fallback: {} }),
    }),
  )
  .derive('plugin', ({ request }) => {
    const userId = request.headers.get('x-nuvix-test-user')
    const sessionId = request.headers.get('x-nuvix-test-session')
    return {
      db: mockSession,
      user: (userId && getCollection('users').get(userId)) || currentUser,
      session: (sessionId && getCollection('sessions').get(sessionId)) || currentSession,
      project: { id: 'proj_1' },
    }
  })
  .use(
    accountRoutes({
      oauth2: { registry: fakeRegistry },
    }),
  )

const BASE = 'http://localhost'

describe('OAuth2 routes', () => {
  it('302s to the provider authorize URL with state (begin flow)', async () => {
    const res = await testApp.handle(
      new Request(
        `${BASE}/account/sessions/oauth2/google?success=https%3A%2F%2Fapp.example.com%2Fdone`,
      ),
    )
    expect(res.status).toBe(302)
    const location = res.headers.get('location')!
    expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth?')
    expect(location).toContain('client_id=test-app-id')
    expect(res.headers.get('cache-control')).toContain('no-store')

    const state = JSON.parse(decodeURIComponent(new URL(location).searchParams.get('state')!)) as {
      success: string
      failure: string
      token: boolean
    }
    expect(state.success).toBe('https://app.example.com/done')
    expect(state.token).toBe(false)
  })

  it("rejects success URLs outside the project's platforms", async () => {
    const res = await testApp.handle(
      new Request(`${BASE}/account/sessions/oauth2/google?success=https%3A%2F%2Fevil.example.com`),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('project_invalid_success_url')
  })

  it('rejects unsupported providers', async () => {
    const res = await testApp.handle(new Request(`${BASE}/account/sessions/oauth2/github`))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('project_provider_unsupported')
  })

  it('rejects disabled providers with 412', async () => {
    const res = await testApp.handle(new Request(`${BASE}/account/sessions/oauth2/disabled`))
    expect(res.status).toBe(412)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('project_provider_disabled')
  })

  it('rejects providers without credentials with 412', async () => {
    const res = await testApp.handle(new Request(`${BASE}/account/sessions/oauth2/unconfigured`))
    expect(res.status).toBe(412)
  })

  it('creates user + identity + session on callback and sets the cookie', async () => {
    // Build state pointing at the default relay page.
    const state = encodeURIComponent(
      JSON.stringify({
        success: `${BASE}/auth/oauth2/success`,
        failure: `${BASE}/auth/oauth2/failure`,
        token: false,
      }),
    )

    const res = await testApp.handle(
      new Request(`${BASE}/account/sessions/oauth2/google/callback?code=good-code&state=${state}`),
    )

    expect(res.status).toBe(302)
    const location = new URL(res.headers.get('location')!)
    expect(location.pathname).toBe('/auth/oauth2/success')
    // The relay receives the session key and secret needed to complete the browser flow.
    expect(location.searchParams.get('key')).toBe(sessionCookieName())
    expect(location.searchParams.get('secret')).toBeTruthy()

    // Cookie issued for the fresh session
    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toContain(`${sessionCookieName()}=`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=none')

    // User + identity + session created
    const users = [...getCollection('users').values()]
    expect(users).toHaveLength(1)
    const user = users[0]!.toObject() as Record<string, unknown>
    expect(user.email).toBe(PROFILE.email)
    expect(user.emailVerification).toBe(true)

    const identities = [...getCollection('identities').values()]
    expect(identities).toHaveLength(1)
    const identity = identities[0]!.toObject() as Record<string, unknown>
    expect(identity.provider).toBe('google')
    expect(identity.providerUid).toBe(PROFILE.sub)
    expect(identity.providerAccessToken).toBe('at-1')
    expect(identity.providerRefreshToken).toBe('rt-1')

    const sessions = [...getCollection('sessions').values()]
    expect(sessions).toHaveLength(1)
    const session = sessions[0]!.toObject() as Record<string, unknown>
    expect(session.provider).toBe('google')
    expect(session.factors).toEqual(['email', 'oauth2'])

    // A verified provider email creates the corresponding email target.
    const targets = [...getCollection('targets').values()]
    expect(targets).toHaveLength(1)
    expect((targets[0]!.toObject() as Record<string, unknown>).identifier).toBe(PROFILE.email)
  })

  it('links a returning provider identity without duplicating the user', async () => {
    const before = getCollection('users').size

    const state = encodeURIComponent(
      JSON.stringify({ success: `${BASE}/auth/oauth2/success`, token: false }),
    )

    const res = await testApp.handle(
      new Request(`${BASE}/account/sessions/oauth2/google/callback?code=good-code&state=${state}`),
    )
    expect(res.status).toBe(302)
    expect(getCollection('users').size).toBe(before)
    // Identity is updated, not duplicated
    expect(getCollection('identities').size).toBe(1)
  })

  it('redirects to failure URL with error params when the provider fails', async () => {
    const state = encodeURIComponent(
      JSON.stringify({
        success: 'https://app.example.com/done',
        failure: 'https://app.example.com/oops',
        token: false,
      }),
    )

    const res = await testApp.handle(
      new Request(`${BASE}/account/sessions/oauth2/google/callback?code=bad-code&state=${state}`),
    )
    expect(res.status).toBe(302)
    const location = new URL(res.headers.get('location')!)
    expect(location.origin + location.pathname).toBe('https://app.example.com/oops')
    const error = JSON.parse(location.searchParams.get('error')!) as {
      message: string
      code: number
    }
    expect(error.code).toBe(424)
    expect(error.message).toContain('google OAuth2 provider returned an error')
  })

  it('token flow returns userId + secret as query params and mints an OAUTH2 token', async () => {
    // Begin a token-based OAuth2 flow.
    const begin = await testApp.handle(new Request(`${BASE}/account/tokens/oauth2/google`))
    expect(begin.status).toBe(302)
    const state = JSON.parse(
      decodeURIComponent(new URL(begin.headers.get('location')!).searchParams.get('state')!),
    ) as { token: boolean }
    expect(state.token).toBe(true)

    // Complete the flow and inspect the returned token credentials.
    const encodedState = encodeURIComponent(
      JSON.stringify({
        success: 'https://app.example.com/token-cb',
        token: true,
      }),
    )
    const res = await testApp.handle(
      new Request(
        `${BASE}/account/sessions/oauth2/google/callback?code=good-code&state=${encodedState}`,
      ),
    )
    if (res.status !== 302) console.log('TOKEN-FLOW-DEBUG', res.status, await res.text())
    expect(res.status).toBe(302)
    const location = new URL(res.headers.get('location')!)
    expect(location.searchParams.get('userId')).toBeTruthy()
    expect(location.searchParams.get('secret')).toBeTruthy()
    // No session cookie on the token flow
    expect(res.headers.get('set-cookie')).toBeNull()

    const tokens = [...getCollection('tokens').values()]
    expect(tokens).toHaveLength(1)
    // Persist the OAuth2 token type marker on the created token record.
    expect((tokens[0]!.toObject() as Record<string, unknown>).type).toBe(7)
  })

  it('refreshes provider tokens when an OAuth2 session is PATCHed', async () => {
    // Seed a Google OAuth2 session carrying stale provider tokens.
    const userDoc = await mockSession.createDocument(
      'users',
      new Doc({
        $id: 'user-oauth',
        email: PROFILE.email,
        status: true,
      }),
    )
    const sessionDoc = await mockSession.createDocument(
      'sessions',
      new Doc({
        $id: 'sess-oauth',
        userId: userDoc.getId(),
        provider: 'google',
        providerUid: PROFILE.sub,
        providerAccessToken: 'stale-at',
        providerRefreshToken: 'stale-rt',
        secret: 'x',
        expire: new Date(Date.now() + 60_000),
      }),
    )

    // PATCH as the owning caller (session context resolves `current`).
    const res = await testApp.handle(
      new Request(`${BASE}/account/sessions/current`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          // tenant-context shim: the test derive trusts these directly
          'x-nuvix-test-user': userDoc.getId(),
          'x-nuvix-test-session': sessionDoc.getId(),
        },
      }),
    )
    if (res.status !== 200) console.log('PATCH-DEBUG', res.status, await res.text())
    expect(res.status).toBe(200)

    const updated = (
      (await mockSession.getDocument('sessions', sessionDoc.getId())) as Doc
    ).toObject() as Record<string, unknown>
    // Refreshing rotates the access token while preserving the provider refresh token.
    expect(updated.providerAccessToken).toBe('at-1')
    expect(updated.providerRefreshToken).toBe('stale-rt')
    expect(updated.providerAccessTokenExpiry).toBeTruthy()
  })

  it('provider-reported errors redirect to failure with the error message', async () => {
    const state = encodeURIComponent(
      JSON.stringify({
        success: 'https://app.example.com/done',
        failure: 'https://app.example.com/oops',
      }),
    )

    const res = await testApp.handle(
      new Request(
        `${BASE}/account/sessions/oauth2/google/callback?error=access_denied&error_description=User%20denied&state=${state}`,
      ),
    )
    expect(res.status).toBe(302)
    const error = JSON.parse(new URL(res.headers.get('location')!).searchParams.get('error')!) as {
      message: string
    }
    expect(error.message).toContain('access_denied')
    expect(error.message).toContain('User denied')
  })

  it('without a failure URL, provider errors surface as problem+json', async () => {
    const state = encodeURIComponent(JSON.stringify({ success: 'https://app.example.com/done' }))
    const res = await testApp.handle(
      new Request(`${BASE}/account/sessions/oauth2/google/callback?code=bad-code&state=${state}`),
    )
    expect(res.status).toBe(424)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('user_oauth2_provider_error')
  })
})
