import { describe, expect, it, mock } from 'bun:test'
import { Auth } from '@nuvix/core/auth'
import { Doc, type Session } from '@nuvix/db'
import { NotFoundError } from '../../shared/errors'
import { SessionsService } from './service'

describe('SessionsService', () => {
  it('creates a session with generated secret and calculates expiry', async () => {
    let createdSessionDoc: Doc<Record<string, unknown>> = new Doc({})
    const mockSession = {
      find: mock(() => Promise.resolve([])), // no existing sessions
      createDocument: mock((_col: string, doc: Doc<Record<string, unknown>>) => {
        createdSessionDoc = doc
        return Promise.resolve(doc)
      }),
    } as unknown as Session

    const service = new SessionsService(mockSession)
    const result = await service.create(
      'usr_123',
      'email',
      'test@example.com',
      ['email'],
      { ip: '192.168.1.1', userAgent: 'Bun/1.4' },
      { auths: { duration: 3600 } }, // 1 hour
    )

    expect(result.userId).toBe('usr_123')
    expect(result.provider).toBe('email')
    expect(result.providerUid).toBe('test@example.com')
    expect(result.ip).toBe('192.168.1.1')
    expect(result.secret).toBeDefined()
    expect(result.current).toBe(true)
    expect(createdSessionDoc.get('secretHash')).toBeDefined()
  })

  it('enforces session cap by evicting oldest sessions', async () => {
    const deletedSessionIds: string[] = []
    const oldSession1 = new Doc({
      $id: 'sess_old_1',
      userId: 'usr_123',
      expire: '2026-01-01T00:00:00.000Z',
    })
    const oldSession2 = new Doc({
      $id: 'sess_old_2',
      userId: 'usr_123',
      expire: '2026-01-02T00:00:00.000Z',
    })
    const activeSession = new Doc({
      $id: 'sess_active',
      userId: 'usr_123',
      expire: '2026-12-31T00:00:00.000Z',
    })

    const mockSession = {
      find: mock(() => Promise.resolve([oldSession1, oldSession2, activeSession])),
      deleteDocument: mock((_col: string, id: string) => {
        deletedSessionIds.push(id)
        return Promise.resolve(true)
      }),
      createDocument: mock((_col: string, doc: Doc<Record<string, unknown>>) =>
        Promise.resolve(doc),
      ),
    } as unknown as Session

    const service = new SessionsService(mockSession)
    await service.create(
      'usr_123',
      'email',
      'test@example.com',
      ['email'],
      {},
      { limits: { userSessionsDefault: 2 } }, // cap is 2, existing is 3, need to evict 2 oldest
    )

    expect(deletedSessionIds).toContain('sess_old_1')
    expect(deletedSessionIds).toContain('sess_old_2')
  })

  it('verifies a valid session secret', async () => {
    const rawSecret = 'super-secure-session-secret'
    const secretHash = Auth.hash(rawSecret)

    const mockSessionDoc = new Doc({
      $id: 'sess_valid',
      userId: 'usr_456',
      expire: new Date(Date.now() + 100000).toISOString(),
      factors: ['email'],
      secretHash,
    })

    const mockUserDoc = new Doc({
      $id: 'usr_456',
      status: true,
    })

    const mockSession = {
      findOne: mock(() => Promise.resolve(mockSessionDoc)),
      getDocument: mock(() => Promise.resolve(mockUserDoc)),
    } as unknown as Session

    const service = new SessionsService(mockSession)
    const verified = await service.verify(rawSecret)

    expect(verified).not.toBeNull()
    expect(verified?.sessionId).toBe('sess_valid')
    expect(verified?.userId).toBe('usr_456')
    expect(verified?.factors).toEqual(['email'])
  })

  it('returns null when verifying secret with expired session', async () => {
    const rawSecret = 'super-secure-session-secret'
    const secretHash = Auth.hash(rawSecret)

    const expiredDoc = new Doc({
      $id: 'sess_expired',
      userId: 'usr_456',
      expire: new Date(Date.now() - 10000).toISOString(), // expired
      secretHash,
    })

    const mockSession = {
      findOne: mock(() => Promise.resolve(expiredDoc)),
    } as unknown as Session

    const service = new SessionsService(mockSession)
    const verified = await service.verify(rawSecret)

    expect(verified).toBeNull()
  })

  it('returns null when user account is blocked', async () => {
    const rawSecret = 'super-secure-session-secret'
    const secretHash = Auth.hash(rawSecret)

    const mockSessionDoc = new Doc({
      $id: 'sess_valid',
      userId: 'usr_blocked',
      expire: new Date(Date.now() + 100000).toISOString(),
      secretHash,
    })

    const mockUserDoc = new Doc({
      $id: 'usr_blocked',
      status: false, // blocked!
    })

    const mockSession = {
      findOne: mock(() => Promise.resolve(mockSessionDoc)),
      getDocument: mock(() => Promise.resolve(mockUserDoc)),
    } as unknown as Session

    const service = new SessionsService(mockSession)
    const verified = await service.verify(rawSecret)

    expect(verified).toBeNull()
  })

  it('gets a session by id', async () => {
    const mockSession = {
      getDocument: mock(() =>
        Promise.resolve(
          new Doc({
            $id: 'sess_1',
            userId: 'usr_1',
            provider: 'email',
            expire: '2027-01-01T00:00:00.000Z',
          }),
        ),
      ),
    } as unknown as Session

    const service = new SessionsService(mockSession)
    const session = await service.get('sess_1', 'sess_1')

    expect(session.$id).toBe('sess_1')
    expect(session.current).toBe(true)
  })

  it('throws NotFoundError when session is not found', async () => {
    const mockSession = {
      getDocument: mock(() => Promise.resolve(new Doc({}))),
    } as unknown as Session

    const service = new SessionsService(mockSession)
    await expect(service.get('sess_unknown')).rejects.toThrow(NotFoundError)
  })

  it('lists user sessions', async () => {
    const mockSession = {
      find: mock(() =>
        Promise.resolve([
          new Doc({ $id: 's1', userId: 'u1', expire: '2027-01-01' }),
          new Doc({ $id: 's2', userId: 'u1', expire: '2027-01-02' }),
        ]),
      ),
    } as unknown as Session

    const service = new SessionsService(mockSession)
    const list = await service.list('u1', 's1')

    expect(list.length).toBe(2)
    expect(list[0]?.current).toBe(true)
    expect(list[1]?.current).toBe(false)
  })

  it('deletes a single session', async () => {
    let deletedId = ''
    const mockSession = {
      getDocument: mock(() => Promise.resolve(new Doc({ $id: 's1' }))),
      deleteDocument: mock((_col: string, id: string) => {
        deletedId = id
        return Promise.resolve(true)
      }),
    } as unknown as Session

    const service = new SessionsService(mockSession)
    await service.delete('s1')

    expect(deletedId).toBe('s1')
  })

  it('deletes all user sessions except specified session', async () => {
    const deletedIds: string[] = []
    const mockSession = {
      find: mock(() =>
        Promise.resolve([
          new Doc({ $id: 's1', userId: 'u1' }),
          new Doc({ $id: 's2', userId: 'u1' }),
          new Doc({ $id: 's3', userId: 'u1' }),
        ]),
      ),
      deleteDocument: mock((_col: string, id: string) => {
        deletedIds.push(id)
        return Promise.resolve(true)
      }),
    } as unknown as Session

    const service = new SessionsService(mockSession)
    await service.deleteAll('u1', 's2') // keep s2

    expect(deletedIds).toEqual(['s1', 's3'])
  })
})
