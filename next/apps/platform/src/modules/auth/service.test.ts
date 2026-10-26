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

/** In-memory platform session covering the console-auth surface. */
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

    // Only the HASH of the refresh token is stored.
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

    // New pair, new hash; the old hash moved to previousHash.
    expect(second.refreshToken).not.toBe(first.refreshToken)
    const row = [...session.store.get('console_sessions')!.values()][0]!
    expect(row.get('refreshHash')).toBe(hashRefreshToken(second.refreshToken))
    expect(row.get('previousHash')).toBe(hashRefreshToken(first.refreshToken))

    // Re-presenting the rotated-away token = theft → session revoked.
    await expect(service.refresh(first.refreshToken)).rejects.toThrow()
    expect(session.store.get('console_sessions')!.size).toBe(0)

    // Even the CURRENT token is dead now (its session was revoked).
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
    // Idempotent: revoking an unknown token succeeds.
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
    // Stored as an Argon2 hash, never plaintext.
    expect(String(doc.get('passwordHash'))).toContain('$argon2')

    // The seeded operator can log in.
    const pair = await service.login('root@test', 'bootstrap-secret')
    expect(pair.user.email).toBe('root@test')

    delete process.env.NUVIX_CONSOLE_EMAIL
    delete process.env.NUVIX_CONSOLE_PASSWORD
  })
})
