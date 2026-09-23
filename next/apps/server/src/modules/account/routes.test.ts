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
    emailVerification: true,
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
    secretHash: hashSecret('mock_secret'),
  })

  const mockSession = {
    getDocument: (col: string, id: string) => {
      if (col === 'users' && id === 'user_acc_1') return Promise.resolve(userDoc)
      if (col === 'sessions' && id === 'sess_acc_1') return Promise.resolve(sessionDoc)
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
      return Promise.resolve(new Doc({}))
    },
    find: (col: string) => {
      if (col === 'targets') return Promise.resolve([])
      if (col === 'sessions') return Promise.resolve([sessionDoc])
      return Promise.resolve([])
    },
    count: () => Promise.resolve(1),
    createDocument: (_col: string, doc: Doc<Record<string, unknown>>) => Promise.resolve(doc),
    updateDocument: (_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
      Promise.resolve(
        new Doc({
          ...userDoc.toObject(),
          ...doc.toObject(),
        }),
      ),
    deleteDocument: () => Promise.resolve(true),
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

  test('DELETE /account deletes account', async () => {
    const { data, status } = await client.account.delete()

    expect(status).toBe(200)
    expect(data?.ok).toBe(true)
  })
})
