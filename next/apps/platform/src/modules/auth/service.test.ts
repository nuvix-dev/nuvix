/** Service-level coverage for console login, refresh-token rotation, throttling, and session revocation. */
import { describe, expect, it } from 'bun:test'
import { verifyJwt } from '@nuvix/core/auth'
import { Doc } from '@nuvix/db'
import {
  bootstrapConsoleUser,
  CONSOLE_ACCESS_TTL_SECONDS,
  ConsoleAuthService,
  hashRefreshToken,
} from './service'

process.env.NUVIX_JWT_SECRET ??= 'test-jwt-secret'

/** In-memory platform session that isolates console-auth behavior from database infrastructure. */
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

  return {
    store,
    async findOne(_collection: string, queryFn: (qb: QueryRecorder) => QueryRecorder) {
      const qb = new QueryRecorder()
      queryFn(qb)
      for (const doc of colOf(_collection).values()) {
        if (qb.matches(doc)) return doc
      }
      return new Doc()
    },
    async find(_collection: string, queries: Array<unknown> = []) {
      let all = [...colOf(_collection).values()]
      for (const query of queries) {
        const q = query as { getAttribute?: () => string; values?: unknown[] }
        const attr = q.getAttribute?.()
        const values = q.values
        if (attr && values) {
          all = all.filter((d) => values.includes(d.get(attr)))
        }
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

/** Records `.equal()` chains for the callback-style findOne. */
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

function makeService() {
  const session = stubSession()
  const db = { system: () => session } as never
  const service = new ConsoleAuthService(db)
  return { service, session }
}

async function seedUser(
  session: ReturnType<typeof stubSession>,
  email = 'op@test',
  password = 'correct-horse',
) {
  const { Auth } = await import('@nuvix/core/auth')
  const doc = new Doc<Record<string, unknown>>({
    $id: 'user_1',
    email,
    name: 'Operator',
    passwordHash: await Auth.passwordHash(password),
  })
  session.store.set('console_users', new Map([['user_1', doc]]))
  return doc
}

describe('ConsoleAuthService', () => {
  it('logs in with valid credentials and mints a verifiable pair', async () => {
    const { service, session } = makeService()
    await seedUser(session)

    const pair = await service.login('op@test', 'correct-horse', 'cli/1.0')

    expect(pair.accessToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(pair.refreshToken).toHaveLength(43) // 32 bytes base64url
    expect(pair.expiresIn).toBe(CONSOLE_ACCESS_TTL_SECONDS)
    expect(pair.user).toEqual({
      $id: 'user_1',
      email: 'op@test',
      name: 'Operator',
    })

    const payload = await verifyJwt(pair.accessToken, process.env.NUVIX_JWT_SECRET!)
    expect(payload?.aud).toBe('console')
    expect(payload?.sub).toBe('user_1')
    expect(payload?.email).toBe('op@test')

    // Persist only the refresh-token hash so a database read cannot recover the bearer credential.
    const sessionRow = [...session.store.get('console_sessions')!.values()][0]!
    expect(sessionRow.get('refreshHash')).toBe(hashRefreshToken(pair.refreshToken))
    expect(sessionRow.get('previousHash')).toBeNull()
  })

  it('rejects unknown emails and wrong passwords with the same error (no enumeration)', async () => {
    const { service, session } = makeService()
    await seedUser(session)

    for (const [email, password] of [
      ['nobody@test', 'correct-horse'],
      ['op@test', 'wrong'],
    ] as const) {
      let code = ''
      await service.login(email, password).catch((error: unknown) => {
        code = (error as { fields?: { code?: string } }).fields?.code ?? ''
      })
      expect(code).toBe('console_invalid_credentials')
    }
    // No session rows were created for failed logins.
    expect(session.store.get('console_sessions')?.size ?? 0).toBe(0)
  })

  it('rotates the refresh token and detects reuse (revokes the session)', async () => {
    const { service, session } = makeService()
    await seedUser(session)

    const first = await service.login('op@test', 'correct-horse')
    const second = await service.refresh(first.refreshToken)

    // Rotation issues a new pair and retains the previous hash for reuse detection.
    expect(second.refreshToken).not.toBe(first.refreshToken)
    const row = [...session.store.get('console_sessions')!.values()][0]!
    expect(row.get('refreshHash')).toBe(hashRefreshToken(second.refreshToken))
    expect(row.get('previousHash')).toBe(hashRefreshToken(first.refreshToken))

    // Reusing a rotated token is treated as credential theft and revokes the session.
    await expect(service.refresh(first.refreshToken)).rejects.toThrow()
    expect(session.store.get('console_sessions')!.size).toBe(0)

    // The current token is also invalid because its session was revoked.
    await expect(service.refresh(second.refreshToken)).rejects.toThrow()
  })

  it('rejects garbage and expired refresh tokens', async () => {
    const { service, session } = makeService()
    await seedUser(session)

    await expect(service.refresh('garbage')).rejects.toThrow()

    const first = await service.login('op@test', 'correct-horse')
    const row = [...session.store.get('console_sessions')!.values()][0]!
    row.set('expireAt', new Date(Date.now() - 1000))
    await expect(service.refresh(first.refreshToken)).rejects.toThrow()
    expect(session.store.get('console_sessions')!.size).toBe(0)
  })

  it('logout revokes the session; refresh then fails', async () => {
    const { service, session } = makeService()
    await seedUser(session)

    const pair = await service.login('op@test', 'correct-horse')
    await service.logout(pair.refreshToken)
    expect(session.store.get('console_sessions')!.size).toBe(0)

    await expect(service.refresh(pair.refreshToken)).rejects.toThrow()
    // Logout is idempotent, so revoking an unknown token still succeeds.
    await expect(service.logout('unknown-token')).resolves.toBeUndefined()
  })

  it('getMe returns the operator and 401s for unknown ids', async () => {
    const { service, session } = makeService()
    await seedUser(session)

    const me = await service.getMe('user_1')
    expect(me.email).toBe('op@test')

    let code = ''
    await service.getMe('nobody').catch((error: { fields?: { code?: string } }) => {
      code = error.fields?.code ?? ''
    })
    expect(code).toBe('console_unauthorized')
  })
})

describe('login throttling (hardening pass)', () => {
  it('locks an email+client after MAX_FAILURES and recovers after the window', async () => {
    const { service, session } = makeService()
    await seedUser(session)

    const codes: Array<string | number> = []
    for (let i = 0; i < 6; i++) {
      await service.login('op@test', 'wrong', undefined, 'cli').catch((error: unknown) => {
        const err = error as { fields?: { code?: string }; retryAfterSeconds?: number }
        codes.push(err.fields?.code ?? err.retryAfterSeconds ?? 'thrown')
      })
    }
    // The first five failures report invalid credentials; the sixth is throttled.
    const throttled = codes.filter((c) => c !== 'console_invalid_credentials')
    expect(throttled).toHaveLength(1)
    expect(Number(throttled[0])).toBeGreaterThan(0)

    // A correct password remains throttled while the credential window is active.
    await expect(service.login('op@test', 'correct-horse', undefined, 'cli')).rejects.toThrow()

    // A different client key has an independent lockout window.
    const otherClient = await service.login('op@test', 'correct-horse', undefined, 'other')
    expect(otherClient.user.email).toBe('op@test')
  })

  it('resets the failure counter after a successful login', async () => {
    const { service, session } = makeService()
    await seedUser(session)
    // Use a distinct email and client key because the throttle map is module-scoped.
    const email = 'reset@test'
    const client = 'cli-reset'
    await seedUser(session, email)

    // Stay one failure below the throttle limit.
    for (let i = 0; i < 4; i++) {
      await service.login(email, 'wrong', undefined, client).catch(() => {})
    }
    // A successful login resets the failure counter.
    await service.login(email, 'correct-horse', undefined, client)

    // The next four failures should therefore remain invalid-credential responses.
    for (let i = 0; i < 4; i++) {
      await service.login(email, 'wrong', undefined, client).catch((error: unknown) => {
        expect((error as { fields?: { code?: string } }).fields?.code).toBe(
          'console_invalid_credentials',
        )
      })
    }
  })
})

describe('bootstrapConsoleUser', () => {
  it('seeds the env operator once (idempotent)', async () => {
    const { service, session } = makeService()
    process.env.NUVIX_CONSOLE_EMAIL = 'root@test'
    process.env.NUVIX_CONSOLE_PASSWORD = 'bootstrap-secret'

    await bootstrapConsoleUser({ system: () => session } as never)
    await bootstrapConsoleUser({ system: () => session } as never)

    const users = session.store.get('console_users')!
    expect(users.size).toBe(1)
    const doc = [...users.values()][0]!
    expect(doc.get('email')).toBe('root@test')
    // The bootstrap password is stored as an Argon2 hash, never as plaintext.
    expect(String(doc.get('passwordHash'))).toContain('$argon2')

    // Verify that the seeded operator can authenticate with the configured password.
    const pair = await service.login('root@test', 'bootstrap-secret')
    expect(pair.user.email).toBe('root@test')

    delete process.env.NUVIX_CONSOLE_EMAIL
    delete process.env.NUVIX_CONSOLE_PASSWORD
  })
})
