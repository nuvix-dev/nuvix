import { describe, expect, it, mock } from 'bun:test'
import { hashPassword } from '@nuvix/core/auth'
import { Doc, type Session } from '@nuvix/db'
import { AppError, BadRequestError, UnauthorizedError } from '../../shared/errors'
import { verifyJwt } from '../../utils/jwt'
import { AccountService } from './service'

describe('AccountService', () => {
  it('creates an account with an initial session', async () => {
    const createdDocs: Doc<Record<string, unknown>>[] = []
    const mockSession = {
      findOne: mock(() => Promise.resolve(new Doc({}))), // no existing user
      createDocument: mock((_col: string, doc: Doc<Record<string, unknown>>) => {
        createdDocs.push(doc)
        return Promise.resolve(doc)
      }),
      find: mock(() => Promise.resolve([])),
    } as unknown as Session

    const service = new AccountService(mockSession)
    const result = await service.create({
      email: 'ada@example.com',
      password: 'ValidSecretPass123!',
      name: 'Ada Lovelace',
    })

    expect(result.account.email).toBe('ada@example.com')
    expect(result.account.name).toBe('Ada Lovelace')
    expect(result.session.secret).toBeDefined()
    expect(result.session.provider).toBe('email')
    expect(createdDocs.length).toBe(3) // user + target + session
  })

  it('rejects account creation when email/password auth is disabled', async () => {
    const mockSession = {} as unknown as Session
    const service = new AccountService(mockSession)

    await expect(
      service.create(
        { email: 'disabled@test.com', password: 'Password123!' },
        {},
        { auths: { emailPassword: false } },
      ),
    ).rejects.toThrow(AppError)
  })

  it('rejects account creation when password contains personal data', async () => {
    const mockSession = {} as unknown as Session
    const service = new AccountService(mockSession)

    await expect(
      service.create(
        {
          email: 'ada@example.com',
          password: 'ada-password-123',
          name: 'Ada',
        },
        {},
        { auths: { personalDataCheck: true } },
      ),
    ).rejects.toThrow(BadRequestError)
  })

  it('gets account and targets', async () => {
    const mockSession = {
      getDocument: mock(() =>
        Promise.resolve(
          new Doc({
            $id: 'usr_1',
            email: 'ada@example.com',
            name: 'Ada',
            status: true,
          }),
        ),
      ),
      find: mock(() =>
        Promise.resolve([
          new Doc({
            $id: 'tgt_1',
            providerType: 'email',
            identifier: 'ada@example.com',
          }),
        ]),
      ),
    } as unknown as Session

    const service = new AccountService(mockSession)
    const account = await service.get('usr_1')

    expect(account.$id).toBe('usr_1')
    expect(account.email).toBe('ada@example.com')
    expect(account.targets.length).toBe(1)
  })

  it('throws UnauthorizedError when getting a blocked account', async () => {
    const mockSession = {
      getDocument: mock(() =>
        Promise.resolve(
          new Doc({
            $id: 'usr_1',
            email: 'blocked@example.com',
            status: false, // blocked!
          }),
        ),
      ),
    } as unknown as Session

    const service = new AccountService(mockSession)
    await expect(service.get('usr_1')).rejects.toThrow(UnauthorizedError)
  })

  it('updates password, validates old password, and revokes other sessions', async () => {
    const oldHash = await hashPassword('OldPassword123!')
    const deletedSessionIds: string[] = []

    const mockSession = {
      getDocument: mock(() =>
        Promise.resolve(
          new Doc({
            $id: 'usr_1',
            email: 'user@test.com',
            password: oldHash,
            passwordUpdate: '2026-01-01',
            status: true,
          }),
        ),
      ),
      updateDocument: mock((_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
        Promise.resolve(doc),
      ),
      find: mock((col: string) => {
        if (col === 'sessions') {
          return Promise.resolve([
            new Doc({ $id: 'current_sess' }),
            new Doc({ $id: 'other_sess_1' }),
            new Doc({ $id: 'other_sess_2' }),
          ])
        }
        return Promise.resolve([])
      }),
      deleteDocument: mock((_col: string, id: string) => {
        deletedSessionIds.push(id)
        return Promise.resolve(true)
      }),
    } as unknown as Session

    const service = new AccountService(mockSession)
    await service.updatePassword('usr_1', 'current_sess', {
      oldPassword: 'OldPassword123!',
      password: 'BrandNewPassword999!',
    })

    expect(deletedSessionIds).toContain('other_sess_1')
    expect(deletedSessionIds).toContain('other_sess_2')
    expect(deletedSessionIds).not.toContain('current_sess') // current session kept!
  })

  it('rejects password update if oldPassword does not match', async () => {
    const oldHash = await hashPassword('OldPassword123!')
    const mockSession = {
      getDocument: mock(() =>
        Promise.resolve(
          new Doc({
            $id: 'usr_1',
            password: oldHash,
            passwordUpdate: '2026-01-01',
            status: true,
          }),
        ),
      ),
    } as unknown as Session

    const service = new AccountService(mockSession)
    await expect(
      service.updatePassword('usr_1', 'sess_1', {
        oldPassword: 'WrongPassword!',
        password: 'NewPassword123!',
      }),
    ).rejects.toThrow(UnauthorizedError)
  })

  it('logs in with email and password', async () => {
    const passHash = await hashPassword('Secret123!')
    let createdSessionDoc: Doc<Record<string, unknown>> = new Doc({})

    const mockSession = {
      findOne: mock(() =>
        Promise.resolve(
          new Doc({
            $id: 'usr_1',
            email: 'ada@example.com',
            password: passHash,
            status: true,
          }),
        ),
      ),
      find: mock(() => Promise.resolve([])), // no existing sessions
      createDocument: mock((_col: string, doc: Doc<Record<string, unknown>>) => {
        createdSessionDoc = doc
        return Promise.resolve(doc)
      }),
    } as unknown as Session

    const service = new AccountService(mockSession)
    const session = await service.loginEmail('ada@example.com', 'Secret123!', { ip: '10.0.0.1' })

    expect(session.userId).toBe('usr_1')
    expect(session.provider).toBe('email')
    expect(session.secret).toBeDefined()
    expect(createdSessionDoc.get('secretHash')).toBeDefined()
  })

  it('creates an anonymous session', async () => {
    let createdUserDoc: Doc<Record<string, unknown>> = new Doc({})
    let createdSessionDoc: Doc<Record<string, unknown>> = new Doc({})

    const mockSession = {
      find: mock(() => Promise.resolve([])),
      createDocument: mock((col: string, doc: Doc<Record<string, unknown>>) => {
        if (col === 'users') createdUserDoc = doc
        if (col === 'sessions') createdSessionDoc = doc
        return Promise.resolve(doc)
      }),
    } as unknown as Session

    const service = new AccountService(mockSession)
    const session = await service.loginAnonymous({ ip: '10.0.0.1' })

    expect(session.provider).toBe('anonymous')
    expect(session.secret).toBeDefined()
    expect(createdUserDoc.get('name')).toBe('Anonymous User')
    expect(createdSessionDoc.get('userId')).toBeDefined()
  })

  it('mints short-lived JWT from session', async () => {
    const jwtSecret = 'super-jwt-signing-secret-key-12345'
    const mockSession = {
      getDocument: mock(() =>
        Promise.resolve(
          new Doc({
            $id: 'sess_100',
            userId: 'usr_200',
          }),
        ),
      ),
    } as unknown as Session

    const service = new AccountService(mockSession)
    const { jwt } = await service.mintJwt('usr_200', 'sess_100', jwtSecret, 900)

    expect(jwt).toBeDefined()
    const payload = await verifyJwt(jwt, jwtSecret)
    expect(payload?.sub).toBe('usr_200')
    expect(payload?.sid).toBe('sess_100')
  })

  it('creates and confirms email verification', async () => {
    let createdTokenDoc: Doc<Record<string, unknown>> = new Doc({})
    let deletedTokenId = ''

    const mockSession = {
      getDocument: mock(() =>
        Promise.resolve(
          new Doc({
            $id: 'usr_v1',
            email: 'verify@example.com',
            emailVerification: false,
            status: true,
          }),
        ),
      ),
      createDocument: mock((_col: string, doc: Doc<Record<string, unknown>>) => {
        createdTokenDoc = doc
        return Promise.resolve(doc)
      }),
      findOne: mock(() => Promise.resolve(createdTokenDoc)),
      updateDocument: mock((_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
        Promise.resolve(doc),
      ),
      deleteDocument: mock((_col: string, id: string) => {
        deletedTokenId = id
        return Promise.resolve(true)
      }),
      find: mock(() => Promise.resolve([])),
    } as unknown as Session

    const service = new AccountService(mockSession)
    const { secret, url } = await service.createEmailVerification(
      'usr_v1',
      'https://example.com/verify',
    )

    expect(secret).toBeDefined()
    expect(url).toContain('secret=')
    expect(url).toContain('userId=usr_v1')

    const updatedAccount = await service.confirmEmailVerification('usr_v1', secret)
    expect(updatedAccount.emailVerification).toBe(true)
    expect(deletedTokenId).toBe(createdTokenDoc.getId())
  })

  it('creates and confirms phone verification', async () => {
    let createdTokenDoc: Doc<Record<string, unknown>> = new Doc({})

    const mockSession = {
      getDocument: mock(() =>
        Promise.resolve(
          new Doc({
            $id: 'usr_p1',
            phone: '+15551234567',
            phoneVerification: false,
            status: true,
          }),
        ),
      ),
      createDocument: mock((_col: string, doc: Doc<Record<string, unknown>>) => {
        createdTokenDoc = doc
        return Promise.resolve(doc)
      }),
      findOne: mock(() => Promise.resolve(createdTokenDoc)),
      updateDocument: mock((_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
        Promise.resolve(doc),
      ),
      deleteDocument: mock(() => Promise.resolve(true)),
      find: mock(() => Promise.resolve([])),
    } as unknown as Session

    const service = new AccountService(mockSession)
    const { secret } = await service.createPhoneVerification('usr_p1')
    expect(secret.length).toBe(6)

    const updatedAccount = await service.confirmPhoneVerification('usr_p1', secret)
    expect(updatedAccount.phoneVerification).toBe(true)
  })

  it('creates and confirms password recovery', async () => {
    let createdTokenDoc: Doc<Record<string, unknown>> = new Doc({})

    const mockSession = {
      find: mock((col: string) => {
        if (col === 'users') {
          return Promise.resolve([
            new Doc({
              $id: 'usr_r1',
              email: 'rec@example.com',
              status: true,
            }),
          ])
        }
        return Promise.resolve([])
      }),
      getDocument: mock(() =>
        Promise.resolve(
          new Doc({
            $id: 'usr_r1',
            email: 'rec@example.com',
            status: true,
          }),
        ),
      ),
      createDocument: mock((_col: string, doc: Doc<Record<string, unknown>>) => {
        createdTokenDoc = doc
        return Promise.resolve(doc)
      }),
      findOne: mock(() => Promise.resolve(createdTokenDoc)),
      updateDocument: mock((_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
        Promise.resolve(doc),
      ),
      deleteDocument: mock(() => Promise.resolve(true)),
    } as unknown as Session

    const service = new AccountService(mockSession)
    const { secret, userId } = await service.createPasswordRecovery(
      'rec@example.com',
      'https://example.com/reset',
    )
    expect(userId).toBe('usr_r1')
    expect(secret).toBeDefined()

    const updated = await service.confirmPasswordRecovery(
      'usr_r1',
      secret,
      'SuperSecretNewPass123!',
    )
    expect(updated.emailVerification).toBe(true)
  })

  it('lists and deletes OAuth2 identities with ownership check', async () => {
    let deletedId = ''
    const mockSession = {
      find: mock(() =>
        Promise.resolve([
          new Doc({
            $id: 'ident_1',
            userId: 'usr_owner',
            provider: 'github',
            providerUid: '12345',
          }),
        ]),
      ),
      getDocument: mock((_col: string, id: string) => {
        if (id === 'ident_1') {
          return Promise.resolve(
            new Doc({
              $id: 'ident_1',
              userId: 'usr_owner',
              provider: 'github',
            }),
          )
        }
        return Promise.resolve(new Doc({}))
      }),
      deleteDocument: mock((_col: string, id: string) => {
        deletedId = id
        return Promise.resolve(true)
      }),
    } as unknown as Session

    const service = new AccountService(mockSession)
    const identities = await service.listIdentities('usr_owner')
    expect(identities.length).toBe(1)
    expect(identities[0]?.provider).toBe('github')

    await service.deleteIdentity('usr_owner', 'ident_1')
    expect(deletedId).toBe('ident_1')

    // Reject deletion if not owned
    await expect(service.deleteIdentity('usr_attacker', 'ident_1')).rejects.toThrow()
  })

  it('creates, updates, and deletes push targets', async () => {
    let deletedTargetId = ''
    const mockSession = {
      find: mock(() => Promise.resolve([])), // no duplicate targets
      getDocument: mock((col: string, id: string) => {
        if (col === 'sessions') {
          return Promise.resolve(
            new Doc({
              $id: 'sess_1',
              deviceBrand: 'Apple iPhone',
            }),
          )
        }
        if (col === 'targets' && id === 'tgt_push_1') {
          return Promise.resolve(
            new Doc({
              $id: 'tgt_push_1',
              userId: 'usr_1',
              identifier: 'old_push_token',
            }),
          )
        }
        return Promise.resolve(new Doc({}))
      }),
      createDocument: mock((_col: string, doc: Doc<Record<string, unknown>>) =>
        Promise.resolve(doc),
      ),
      updateDocument: mock((_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
        Promise.resolve(doc),
      ),
      deleteDocument: mock((_col: string, id: string) => {
        deletedTargetId = id
        return Promise.resolve(true)
      }),
    } as unknown as Session

    const service = new AccountService(mockSession)
    const target = await service.createPushTarget('usr_1', 'sess_1', {
      identifier: 'expo_push_token_123',
    })

    expect(target.name).toBe('Apple iPhone')
    expect(target.identifier).toBe('expo_push_token_123')

    const updated = await service.updatePushTarget('usr_1', 'tgt_push_1', {
      identifier: 'new_expo_push_token',
    })
    expect(updated.identifier).toBe('new_expo_push_token')

    await service.deletePushTarget('usr_1', 'tgt_push_1')
    expect(deletedTargetId).toBe('tgt_push_1')
  })
})
