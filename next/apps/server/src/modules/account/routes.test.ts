import { describe, expect, test } from 'bun:test'
import { treaty } from '@elysia/eden'
import { hashPassword, hashSecret } from '@nuvix/core/auth'
import { Doc, type Session } from '@nuvix/db'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import { SessionsService } from '../sessions/service'
import { accountRoutes } from './routes'
import { AccountService } from './service'

describe('account routes', async () => {
  const hashedPassword = await hashPassword('password123')

  const userDoc = new Doc({
    $id: 'user_acc_1',
    name: 'Grace Hopper',
    email: 'grace@example.com',
    phone: '+15559876543',
    password: hashedPassword,
    status: true,
    labels: ['pioneer'],
    passwordUpdate: '2026-01-01T00:00:00.000Z',
    registration: '2026-01-01T00:00:00.000Z',
    emailVerification: false,
    phoneVerification: false,
    mfa: false,
    prefs: { color: 'blue' },
    accessedAt: '2026-01-01T00:00:00.000Z',
  })

  const sessionDoc = new Doc({
    $id: 'sess_acc_1',
    userId: 'user_acc_1',
    provider: 'email',
    providerUid: 'grace@example.com',
    expire: '2027-01-01T00:00:00.000Z',
    factors: ['email'],
    ip: '127.0.0.1',
    deviceName: 'MacBook Pro',
    deviceBrand: 'Apple',
    secretHash: hashSecret('mock_secret'),
  })

  const identityDoc = new Doc({
    $id: 'ident_test_1',
    userId: 'user_acc_1',
    provider: 'github',
    providerUid: 'gh_123',
    providerEmail: 'grace@example.com',
  })

  const targetDoc = new Doc({
    $id: 'tgt_push_1',
    userId: 'user_acc_1',
    providerType: 'push',
    identifier: 'push_token_abc',
    name: 'Apple',
    expired: false,
  })

  const tokenStore = new Map<string, Doc<Record<string, unknown>>>()

  const mockSession = {
    getDocument: (col: string, id: string) => {
      if (col === 'users' && id === 'user_acc_1') return Promise.resolve(userDoc)
      if (col === 'sessions' && id === 'sess_acc_1') return Promise.resolve(sessionDoc)
      if (col === 'identities' && id === 'ident_test_1') return Promise.resolve(identityDoc)
      if (col === 'targets' && id === 'tgt_push_1') return Promise.resolve(targetDoc)
      return Promise.resolve(new Doc({}))
    },
    findOne: (col: string, queries?: unknown[]) => {
      if (col === 'users') {
        const queryStr = JSON.stringify(queries ?? [])
        if (queryStr.includes('newuser@example.com')) {
          return Promise.resolve(new Doc({}))
        }
        if (queryStr.includes('grace@example.com') || queryStr.includes('user_acc_1')) {
          return Promise.resolve(userDoc)
        }
        return Promise.resolve(new Doc({}))
      }
      if (col === 'sessions') return Promise.resolve(sessionDoc)
      if (col === 'tokens') {
        const queryStr = JSON.stringify(queries ?? [])
        for (const [, doc] of tokenStore) {
          const secretHash = doc.get('secretHash')
          if (secretHash && queryStr.includes(String(secretHash))) {
            return Promise.resolve(doc)
          }
        }
        return Promise.resolve(new Doc({}))
      }
      return Promise.resolve(new Doc({}))
    },
    find: (col: string) => {
      if (col === 'targets') return Promise.resolve([])
      if (col === 'sessions') return Promise.resolve([sessionDoc])
      if (col === 'identities') return Promise.resolve([identityDoc])
      if (col === 'users') return Promise.resolve([userDoc])
      return Promise.resolve([])
    },
    count: () => Promise.resolve(1),
    createDocument: (col: string, doc: Doc<Record<string, unknown>>) => {
      if (col === 'tokens') {
        tokenStore.set(doc.getId(), doc)
      }
      return Promise.resolve(doc)
    },
    updateDocument: (_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
      Promise.resolve(
        new Doc({
          ...userDoc.toObject(),
          ...doc.toObject(),
        }),
      ),
    deleteDocument: (col: string, id: string) => {
      if (col === 'tokens') {
        tokenStore.delete(id)
      }
      return Promise.resolve(true)
    },
    deleteDocuments: () => Promise.resolve(['id1']),
  } as unknown as Session

  const accountService = new AccountService(mockSession)
  const sessionsService = new SessionsService(mockSession)
  const jwtSecret = 'test-jwt-secret-key-at-least-32-chars-long'

  let currentCaller = {
    userId: 'user_acc_1',
    sessionId: 'sess_acc_1',
  }

  const app = new Elysia()
    .use(
      problemErrors({
        getTranslator: () =>
          Promise.resolve({
            format: (k: string) => k,
          }) as never,
      }),
    )
    .use(
      accountRoutes(
        accountService,
        jwtSecret,
        () => currentCaller,
        () => ({ ip: '127.0.0.1', userAgent: 'test-agent' }),
        sessionsService,
      ),
    )

  const client = treaty(app)

  test('POST /account creates account and returns account and session', async () => {
    const { data, status } = await client.account.post({
      email: 'newuser@example.com',
      password: 'newpassword123',
      name: 'New User',
    })

    expect(status).toBe(200)
    expect(data?.account).toBeDefined()
    expect(data?.session).toBeDefined()
    expect(data?.session.secret).toBeDefined()
  })

  test('GET /account returns current account', async () => {
    const { data, status } = await client.account.get()

    expect(status).toBe(200)
    expect(data?.$id).toBe('user_acc_1')
    expect(data?.name).toBe('Grace Hopper')
    expect(data?.email).toBe('grace@example.com')
  })

  test('GET /account rejects when not authenticated', async () => {
    currentCaller = { userId: '', sessionId: '' }
    const { status } = await client.account.get()
    expect(status).toBe(401)
    currentCaller = { userId: 'user_acc_1', sessionId: 'sess_acc_1' }
  })

  test('PATCH /account/name updates name', async () => {
    const { data, status } = await client.account.name.patch({
      name: 'Admiral Grace Hopper',
    })

    expect(status).toBe(200)
    expect(data?.name).toBe('Admiral Grace Hopper')
  })

  test('GET and PATCH /account/prefs', async () => {
    const patchRes = await client.account.prefs.patch({
      theme: 'dark',
    })
    expect(patchRes.status).toBe(200)
    expect(patchRes.data?.theme).toBe('dark')

    const getRes = await client.account.prefs.get()
    expect(getRes.status).toBe(200)
  })

  test('PATCH /account/password updates password with old password verified', async () => {
    const { status } = await client.account.password.patch({
      password: 'updatedpassword123',
      oldPassword: 'password123',
    })

    expect(status).toBe(200)
  })

  test('PATCH /account/email updates email', async () => {
    const { data, status } = await client.account.email.patch({
      email: 'grace.hopper@example.com',
      password: 'password123',
    })

    expect(status).toBe(200)
    expect(data?.email).toBe('grace.hopper@example.com')
  })

  test('PATCH /account/phone updates phone', async () => {
    const { data, status } = await client.account.phone.patch({
      phone: '+15550001111',
      password: 'password123',
    })

    expect(status).toBe(200)
    expect(data?.phone).toBe('+15550001111')
  })

  test('PATCH /account/status blocks own account', async () => {
    const { data, status } = await client.account.status.patch()

    expect(status).toBe(200)
    expect(data?.ok).toBe(true)
  })

  test('POST /account/sessions/email creates session on valid credentials', async () => {
    const { data, status } = await client.account.sessions.email.post({
      email: 'grace@example.com',
      password: 'password123',
    })

    expect(status).toBe(200)
    expect(data?.userId).toBe('user_acc_1')
    expect(data?.secret).toBeDefined()
  })

  test('POST /account/sessions/anonymous creates anonymous session', async () => {
    const { data, status } = await client.account.sessions.anonymous.post()

    expect(status).toBe(200)
    expect(data?.provider).toBe('anonymous')
    expect(data?.secret).toBeDefined()
  })

  test('GET /account/sessions lists user sessions', async () => {
    const { data, status } = await client.account.sessions.get()

    expect(status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data?.length).toBe(1)
  })

  test('GET /account/sessions/:sessionId with "current" keyword returns session', async () => {
    const { data, status } = await client.account.sessions({ sessionId: 'current' }).get()

    expect(status).toBe(200)
    expect(data?.$id).toBe('sess_acc_1')
    expect(data?.current).toBe(true)
  })

  test('DELETE /account/sessions/:sessionId deletes session', async () => {
    const { data, status } = await client.account.sessions({ sessionId: 'current' }).delete()

    expect(status).toBe(200)
    expect(data?.ok).toBe(true)
  })

  test('DELETE /account/sessions deletes all sessions', async () => {
    const { data, status } = await client.account.sessions.delete()

    expect(status).toBe(200)
    expect(data?.ok).toBe(true)
  })

  test('POST /account/tokens/jwt mints a short-lived access token', async () => {
    const { data, status } = await client.account.tokens.jwt.post({
      duration: 600,
    })

    expect(status).toBe(200)
    expect(data?.jwt).toBeDefined()
    expect(typeof data?.jwt).toBe('string')
  })

  test('email verification flow: POST and PUT /account/verifications/email', async () => {
    const createRes = await client.account.verifications.email.post({
      url: 'https://example.com/confirm',
    })
    expect(createRes.status).toBe(200)
    expect(createRes.data?.secret).toBeDefined()
    expect(createRes.data?.url).toContain('secret=')

    const confirmRes = await client.account.verifications.email.put({
      userId: 'user_acc_1',
      secret: createRes.data?.secret ?? '',
    })
    expect(confirmRes.status).toBe(200)
    expect(confirmRes.data?.$id).toBe('user_acc_1')
  })

  test('phone verification flow: POST and PUT /account/verifications/phone', async () => {
    const createRes = await client.account.verifications.phone.post()
    expect(createRes.status).toBe(200)
    expect(createRes.data?.secret).toBeDefined()
    expect(createRes.data?.secret.length).toBe(6)

    const confirmRes = await client.account.verifications.phone.put({
      userId: 'user_acc_1',
      secret: createRes.data?.secret ?? '',
    })
    expect(confirmRes.status).toBe(200)
    expect(confirmRes.data?.$id).toBe('user_acc_1')
  })

  test('recovery flow: POST and PUT /account/recovery', async () => {
    const createRes = await client.account.recovery.post({
      email: 'grace@example.com',
      url: 'https://example.com/reset',
    })
    expect(createRes.status).toBe(200)
    expect(createRes.data?.userId).toBe('user_acc_1')
    expect(createRes.data?.secret).toBeDefined()

    const confirmRes = await client.account.recovery.put({
      userId: 'user_acc_1',
      secret: createRes.data?.secret ?? '',
      password: 'newRecoveryPass123!',
    })
    expect(confirmRes.status).toBe(200)
    expect(confirmRes.data?.$id).toBe('user_acc_1')
  })

  test('identities: GET /account/identities and DELETE /account/identities/:identityId', async () => {
    const listRes = await client.account.identities.get()
    expect(listRes.status).toBe(200)
    expect(listRes.data?.length).toBe(1)
    expect(listRes.data?.[0]?.provider).toBe('github')

    const delRes = await client.account.identities({ identityId: 'ident_test_1' }).delete()
    expect(delRes.status).toBe(200)
    expect(delRes.data?.ok).toBe(true)
  })

  test('push targets: POST, PUT, DELETE /account/targets/push', async () => {
    const createRes = await client.account.targets.push.post({
      identifier: 'device_push_token_xyz',
    })
    expect(createRes.status).toBe(200)
    expect(createRes.data?.providerType).toBe('push')
    expect(createRes.data?.name).toBe('Apple')

    const updateRes = await client.account
      .targets({ targetId: 'tgt_push_1' })
      .push.put({ identifier: 'updated_token_456' })
    expect(updateRes.status).toBe(200)

    const delRes = await client.account.targets({ targetId: 'tgt_push_1' }).push.delete()
    expect(delRes.status).toBe(200)
    expect(delRes.data?.ok).toBe(true)
  })

  test('DELETE /account deletes account', async () => {
    const { data, status } = await client.account.delete()

    expect(status).toBe(200)
    expect(data?.ok).toBe(true)
  })
})
