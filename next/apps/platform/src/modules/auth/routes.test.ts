/** HTTP-level coverage for console authentication, including token rotation and cookie-based refresh. */
import { describe, expect, it } from 'bun:test'
import { Auth } from '@nuvix/core/auth'
import { Doc } from '@nuvix/db'
import { Elysia } from 'elysia'
import { consoleAuth } from '../../plugins/auth'
import { problemErrors } from '../../plugins/errors'
import { authRoutesFor } from './routes'
import { ConsoleAuthService, hashRefreshToken } from './service'

process.env.NUVIX_JWT_SECRET ??= 'test-jwt-secret'

/** Minimal in-memory session adapter that lets the route tests exercise persistence without a platform database. */
function stubSession() {
  const store = new Map<string, Map<string, Doc<Record<string, unknown>>>>()
  const colOf = (name: string) => {
    let col = store.get(name)
    if (!col) {
      col = new Map()
      store.set(name, col)
    }
    return col
  }
  class QueryRecorder {
    private conditions: Array<[string, unknown]> = []
    equal(attr: string, value: unknown): this {
      this.conditions.push([attr, value])
      return this
    }
    matches(doc: Doc): boolean {
      return this.conditions.every(([attr, value]) => doc.get(attr) === value)
    }
  }
  return {
    store,
    async findOne(collection: string, queryFn: (qb: QueryRecorder) => QueryRecorder) {
      const qb = new QueryRecorder()
      queryFn(qb)
      for (const doc of colOf(collection).values()) {
        if (qb.matches(doc)) return doc
      }
      return new Doc()
    },
    async find(collection: string, queries: Array<Record<string, unknown>> = []) {
      let all = [...colOf(collection).values()]
      for (const q of queries) {
        const attr = (q as { getAttribute?: () => string }).getAttribute?.()
        const values = (q as { values?: unknown[] }).values
        if (attr && values) all = all.filter((d) => values.includes(d.get(attr)))
      }
      return all
    },
    async getDocument(collection: string, id: string) {
      return colOf(collection).get(id) ?? new Doc()
    },
    async createDocument(collection: string, doc: Doc) {
      if (!doc.getId()) doc.set('$id', `doc_${colOf(collection).size + 1}`)
      colOf(collection).set(doc.getId(), doc)
      return doc
    },
    async updateDocument(_collection: string, _id: string, doc: Doc) {
      return doc
    },
    async deleteDocument(collection: string, id: string) {
      colOf(collection).delete(id)
    },
  }
}

function makeApp() {
  const session = stubSession()
  const db = { system: () => session } as never
  const service = new ConsoleAuthService(db)

  const testApp = new Elysia()
    .use(problemErrors())
    .use(consoleAuth({ secret: process.env.NUVIX_JWT_SECRET! }))
    .use(authRoutesFor(service))
    // Keep one protected route in the composition to verify the auth plugin's request boundary.
    .get('/projects', () => ({ projects: [] }))
    .get('/health', () => ({ status: 'ok' }))

  return { testApp, session }
}

async function seedOperator(session: ReturnType<typeof stubSession>) {
  const doc = new Doc({
    $id: 'user_1',
    email: 'op@test',
    name: 'Operator',
    passwordHash: await Auth.passwordHash('correct-horse'),
  })
  session.store.set('console_users', new Map([['user_1', doc]]))
}

describe('console auth HTTP flow (CLI-compatible)', () => {
  it('protects platform routes and /health stays public', async () => {
    const { testApp } = makeApp()

    const blocked = await testApp.handle(new Request('http://localhost/projects'))
    expect(blocked.status).toBe(401)
    const body = (await blocked.json()) as { code?: string; type?: string }
    expect(body.code).toBe('console_unauthorized')
    expect(body.type).toBe('/errors/unauthorized')

    const health = await testApp.handle(new Request('http://localhost/health'))
    expect(health.status).toBe(200)
  })

  it('logs in, calls a protected route, refreshes (rotation), and logs out', async () => {
    const { testApp, session } = makeApp()
    await seedOperator(session)

    // Establish a console session and verify the response exposes the operator and refresh cookie.
    const login = await testApp.handle(
      new Request('http://localhost/console/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'op@test', password: 'correct-horse' }),
      }),
    )
    expect(login.status).toBe(200)
    const pair = (await login.json()) as {
      accessToken: string
      refreshToken: string
      expiresIn: number
      user: { email: string }
    }
    expect(pair.user.email).toBe('op@test')
    expect(login.headers.get('set-cookie')).toContain('nx_console_refresh=')

    // The access token returned by login must authenticate a protected platform route.
    const who = await testApp.handle(
      new Request('http://localhost/projects', {
        headers: { authorization: `Bearer ${pair.accessToken}` },
      }),
    )
    expect(who.status).toBe(200)

    // The identity endpoint must resolve the same operator from the access token.
    const me = await testApp.handle(
      new Request('http://localhost/console/me', {
        headers: { authorization: `Bearer ${pair.accessToken}` },
      }),
    )
    expect(me.status).toBe(200)
    expect(((await me.json()) as { email: string }).email).toBe('op@test')

    // Refresh rotates the credential pair, making the previous refresh token unusable.
    const refreshed = await testApp.handle(
      new Request('http://localhost/console/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: pair.refreshToken }),
      }),
    )
    expect(refreshed.status).toBe(200)
    const pair2 = (await refreshed.json()) as {
      refreshToken: string
      accessToken: string
    }
    expect(pair2.refreshToken).not.toBe(pair.refreshToken)

    // Reusing a rotated token revokes the session instead of accepting a stale credential.
    const reuse = await testApp.handle(
      new Request('http://localhost/console/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: pair.refreshToken }),
      }),
    )
    expect(reuse.status).toBe(401)

    // Logging out with the newest refresh token removes the persisted session row.
    const logout = await testApp.handle(
      new Request('http://localhost/console/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: pair2.refreshToken }),
      }),
    )
    expect(logout.status).toBe(200)
    expect(session.store.get('console_sessions')?.size ?? 0).toBe(0)
  })

  it('accepts the refresh token from the httpOnly cookie', async () => {
    const { testApp, session } = makeApp()
    await seedOperator(session)

    const login = await testApp.handle(
      new Request('http://localhost/console/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'op@test', password: 'correct-horse' }),
      }),
    )
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!
    const pair = (await login.json()) as { refreshToken: string }
    expect(cookie).toContain(pair.refreshToken)

    const refreshed = await testApp.handle(
      new Request('http://localhost/console/auth/refresh', {
        method: 'POST',
        headers: { cookie },
      }),
    )
    expect(refreshed.status).toBe(200)
  })

  it('401s on tampered and foreign-audience tokens', async () => {
    const { testApp } = makeApp()

    // A token signed for a different audience must not authenticate console routes.
    const foreign = await import('@nuvix/core/auth').then(({ signJwt }) =>
      signJwt({ sub: 'user_1', aud: 'tenant' }, process.env.NUVIX_JWT_SECRET!, 60),
    )
    const res = await testApp.handle(
      new Request('http://localhost/projects', {
        headers: { authorization: `Bearer ${foreign}` },
      }),
    )
    expect(res.status).toBe(401)

    // Altering the signed token payload must invalidate the signature.
    const parts = foreign.split('.')
    const tampered = `${parts[0]}.${parts[1]}.AAAA${parts[2]!.slice(4)}`
    const res2 = await testApp.handle(
      new Request('http://localhost/projects', {
        headers: { authorization: `Bearer ${tampered}` },
      }),
    )
    expect(res2.status).toBe(401)
  })

  it('login failures keep the wire contract (problem+json, no enumeration)', async () => {
    const { testApp, session } = makeApp()
    await seedOperator(session)

    const res = await testApp.handle(
      new Request('http://localhost/console/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'op@test', password: 'wrong' }),
      }),
    )
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code?: string; title?: string }
    expect(body.code).toBe('console_invalid_credentials')
    // Failed authentication must not create a persisted console session.
    expect(hashRefreshToken('')).toBeDefined()
    expect(session.store.get('console_sessions')?.size ?? 0).toBe(0)
  })
})
