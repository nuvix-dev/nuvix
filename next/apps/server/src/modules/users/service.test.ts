import { describe, expect, it, mock } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import { ConflictError } from '../../shared/errors'
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

  it('should return usage statistics', async () => {
    const mockSession = {
      count: mock(() => Promise.resolve(5)),
    } as unknown as Session

    const service = new UsersService(mockSession)
    const usage = await service.getUsage('30d')

    expect(usage.range).toBe('30d')
    expect(usage.usersTotal).toBe(5)
    expect(usage.sessionsTotal).toBe(5)
    expect(usage.users.length).toBe(1)
    expect(usage.sessions.length).toBe(1)
  })
})
