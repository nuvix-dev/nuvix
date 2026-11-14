/** Service tests for admin user management over a stubbed tenant session. */
import { describe, expect, it, mock } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import { ConflictError } from '../shared/errors'
import { UsersService } from './service'

describe('UsersService', () => {
  it('should create a user successfully', async () => {
    const mockSession = {
      findOne: mock(() => Promise.resolve(new Doc({}))),
      createDocument: mock((_collectionId: string, doc: Doc<Record<string, unknown>>) =>
        Promise.resolve(doc),
      ),
    } as unknown as Session

    const service = new UsersService(mockSession)

    const result = await service.create({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    })

    expect(result.email).toBe('test@example.com')
    expect(result.name).toBe('Test User')
    expect(mockSession.createDocument).toHaveBeenCalled()
  })

  it('should throw conflict if email already exists', async () => {
    const mockSession = {
      findOne: mock(() => Promise.resolve(new Doc({ $id: 'existing', email: 'test@example.com' }))),
    } as unknown as Session

    const service = new UsersService(mockSession)

    await expect(service.create({ email: 'test@example.com' })).rejects.toThrow(ConflictError)
  })

  it('should return usage statistics from recorded stats rows', async () => {
    // INF rows carry totals; 1d rows carry the series and the
    // window is zero-filled to `limit` buckets.
    const infTotals: Record<string, number> = { users: 5, sessions: 7 }
    const dayRows: Doc[] = [
      new Doc<Record<string, unknown>>({
        $id: 'r1',
        metric: 'users',
        period: '1d',
        time: '2026-10-24T00:00:00Z',
        value: 3,
      }),
    ]
    const mockSession = {
      findOne: async (
        _collection: string,
        query: (qb: { equal: (a: string, v: unknown) => unknown }) => unknown,
      ) => {
        const builder = {
          metric: undefined as string | undefined,
          period: undefined as string | undefined,
          equal(a: string, v: unknown) {
            if (a === 'metric') this.metric = v as string
            if (a === 'period') this.period = v as string
            return this
          },
        }
        query(builder as never)
        if (builder.metric && builder.period === 'inf') {
          const value = infTotals[builder.metric]
          return value === undefined
            ? new Doc({})
            : new Doc({ $id: 'inf', metric: builder.metric, period: 'inf', value })
        }
        return new Doc({})
      },
      find: async (
        _collection: string,
        queries: Array<{ getAttribute?: () => string; values?: unknown[] }> = [],
      ) => {
        const metric = queries.find(
          (q) => typeof q.getAttribute === 'function' && q.getAttribute?.() === 'metric',
        )?.values?.[0]
        return dayRows.filter((r) => r.get('metric') === metric)
      },
    } as unknown as Session

    const service = new UsersService(mockSession)
    const usage = await service.getUsage('30d')

    expect(usage.range).toBe('30d')
    expect(usage.usersTotal).toBe(5)
    expect(usage.sessionsTotal).toBe(7)
    // 30-day window is zero-filled to exactly 30 buckets.
    expect(usage.users).toHaveLength(30)
    expect(usage.sessions).toHaveLength(30)
    // The seeded daily row lands in its bucket; others are zero.
    const seeded = usage.users.find((d) => d.value === 3)
    expect(seeded?.date).toBe('2026-10-24T00:00:00Z')
  })
})
