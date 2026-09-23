import { describe, expect, test } from 'bun:test'
import { treaty } from '@elysia/eden'
import { Doc, type Session } from '@nuvix/db'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import { userRoutes } from './routes'
import { UserService } from './service'

describe('user routes', () => {
  const userDoc = new Doc({
    $id: 'user_test_1',
    name: 'Ada',
    email: 'ada@example.com',
    phone: '+15551234567',
    status: true,
    labels: ['dev'],
    passwordUpdate: '2026-01-01',
    registration: '2026-01-01',
    emailVerification: true,
    phoneVerification: false,
    mfa: false,
    prefs: { theme: 'dark' },
    accessedAt: '2026-01-01',
  })

  const mockSession = {
    getDocument: (_col: string, id: string) => {
      if (id === 'user_test_1') return Promise.resolve(userDoc)
      return Promise.resolve(new Doc({}))
    },
    findOne: () => Promise.resolve(new Doc({})),
    find: (col: string) => {
      if (col === 'targets') return Promise.resolve([])
      return Promise.resolve([userDoc])
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

  const service = new UserService(mockSession)
  const app = new Elysia()
    .use(
      problemErrors({
        getTranslator: () =>
          Promise.resolve({
            format: (k: string) => k,
          }) as never,
      }),
    )
    .use(userRoutes(service))
  const client = treaty(app)

  test('POST /users creates a user', async () => {
    const { data, status } = await client.users.post({
      email: 'ada@example.com',
      name: 'Ada',
    })

    expect(status).toBe(200)
    expect(data?.email).toBe('ada@example.com')
    expect(data?.name).toBe('Ada')
  })

  test('POST /users rejects missing email and phone with 400', async () => {
    const { status } = await client.users.post({ name: 'Only Name' })
    expect(status).toBe(400)
  })

  test('GET /users lists users with pagination meta', async () => {
    const { data, status } = await client.users.get({
      query: { limit: 10, offset: 0 },
    })

    expect(status).toBe(200)
    expect(data?.data.length).toBe(1)
    expect(data?.meta.total).toBe(1)
    expect(data?.meta.limit).toBe(10)
  })

  test('GET /users/:userId returns user', async () => {
    const { data, status } = await client.users({ userId: 'user_test_1' }).get()

    expect(status).toBe(200)
    expect(data?.$id).toBe('user_test_1')
    expect(data?.name).toBe('Ada')
  })

  test('GET /users/:userId returns 404 for unknown user', async () => {
    const { status } = await client.users({ userId: 'unknown_id' }).get()
    expect(status).toBe(404)
  })

  test('PATCH /users/:userId/name updates name', async () => {
    const { data, status } = await client
      .users({ userId: 'user_test_1' })
      .name.patch({ name: 'Ada Lovelace' })

    expect(status).toBe(200)
    expect(data?.name).toBe('Ada Lovelace')
  })

  test('DELETE /users/:userId deletes user', async () => {
    const { data, status } = await client.users({ userId: 'user_test_1' }).delete()

    expect(status).toBe(200)
    expect(data?.ok).toBe(true)
  })
})
