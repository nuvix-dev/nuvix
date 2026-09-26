import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import { BadRequestError, ConflictError, UnauthorizedError } from '../shared/errors'
import {
  AccountIdentitiesService,
  AccountMfaService,
  AccountRecoveryService,
  AccountService,
  AccountSessionsService,
  AccountTargetsService,
} from './service'

function createInMemorySession() {
  const store = new Map<string, Map<string, Doc>>()

  const getCollection = (name: string) => {
    let col = store.get(name)
    if (!col) {
      col = new Map()
      store.set(name, col)
    }
    return col
  }

  return {
    store,
    session: {
      find: async (collection: string, queries: Array<{ values?: unknown[] }> = []) => {
        const col = getCollection(collection)
        const all = [...col.values()]
        if (queries.length === 0) return all
        return all.filter((doc) => {
          for (const q of queries) {
            if (q.values && q.values.length > 0) {
              const val = q.values[0]
              const match =
                doc.get('userId') === val ||
                doc.get('type') === val ||
                doc.get('providerType') === val ||
                doc.get('email') === val ||
                doc.get('verified') === val
              if (!match) return false
            }
          }
          return true
        })
      },
      findOne: async (collection: string, queries: Array<{ values?: unknown[] }> = []) => {
        const col = getCollection(collection)
        for (const doc of col.values()) {
          for (const q of queries) {
            if (q.values && q.values.length > 0) {
              const val = q.values[0]
              if (
                doc.get('email') === val ||
                doc.get('phone') === val ||
                doc.get('providerEmail') === val ||
                doc.get('userId') === val
              ) {
                return doc
              }
            }
          }
        }
        return new Doc({})
      },
      getDocument: async (collection: string, id: string) => {
        const col = getCollection(collection)
        return col.get(id) ?? new Doc({})
      },
      createDocument: async (collection: string, doc: Doc) => {
        const col = getCollection(collection)
        col.set(doc.getId(), doc)
        return doc
      },
      updateDocument: async (collection: string, id: string, doc: Doc) => {
        const col = getCollection(collection)
        col.set(id, doc)
        return doc
      },
      deleteDocument: async (collection: string, id: string) => {
        const col = getCollection(collection)
        col.delete(id)
        return true
      },
      count: async (collection: string) => {
        return getCollection(collection).size
      },
    } as unknown as Session,
  }
}

describe('Account Module Services', () => {
  describe('AccountService', () => {
    it('creates an account, hashes password, and creates email target', async () => {
      const { session } = createInMemorySession()
      const service = new AccountService(session)

      const account = await service.createAccount({
        email: 'user@example.com',
        password: 'SecurePassword123!',
        name: 'Alice',
      })

      expect(account.email).toBe('user@example.com')
      expect(account.name).toBe('Alice')
      expect(account.targets.length).toBe(1)
      expect(account.targets[0]?.identifier).toBe('user@example.com')
    })

    it('rejects duplicate email and personal data in password', async () => {
      const { session } = createInMemorySession()
      const service = new AccountService(session)

      await service.createAccount({
        userId: 'alice123',
        email: 'alice@example.com',
        password: 'SecurePassword123!',
        name: 'Alice',
      })

      await expect(
        service.createAccount({
          email: 'alice@example.com',
          password: 'AnotherPassword123!',
        }),
      ).rejects.toThrow(ConflictError)

      await expect(
        service.createAccount({
          userId: 'bob123',
          email: 'bob@example.com',
          password: 'Passbob123Word!',
        }),
      ).rejects.toThrow(BadRequestError)
    })

    it('manages prefs, name, email, phone, status, and verifications', async () => {
      const { session } = createInMemorySession()
      const service = new AccountService(session)

      const account = await service.createAccount({
        userId: 'user_x',
        email: 'user_x@example.com',
        password: 'ValidPassword123!',
        name: 'User X',
      })

      // Prefs
      await service.updatePrefs(account.$id, { theme: 'dark' })
      const prefs = await service.getPrefs(account.$id)
      expect(prefs.theme).toBe('dark')

      // Name
      const updatedName = await service.updateName(account.$id, 'User X Renamed')
      expect(updatedName.name).toBe('User X Renamed')

      // Password
      const updatedPass = await service.updatePassword(
        account.$id,
        'BrandNewPassword123!',
        'ValidPassword123!',
      )
      expect(updatedPass.$id).toBe(account.$id)

      await expect(
        service.updatePassword(account.$id, 'AnotherNew123!', 'WrongOldPassword!'),
      ).rejects.toThrow(UnauthorizedError)

      // Email update
      const updatedEmail = await service.updateEmail(
        account.$id,
        'newemail@example.com',
        'BrandNewPassword123!',
      )
      expect(updatedEmail.email).toBe('newemail@example.com')

      // Phone update
      const updatedPhone = await service.updatePhone(
        account.$id,
        '+15551234567',
        'BrandNewPassword123!',
      )
      expect(updatedPhone.phone).toBe('+15551234567')

      // Email verification
      const emailToken = await service.createEmailVerification(account.$id)
      expect(emailToken.secret).toBeDefined()
      const verifiedEmail = await service.updateEmailVerification(
        account.$id,
        emailToken.secret ?? '',
      )
      expect(verifiedEmail.$id).toBe(emailToken.$id)

      // Phone verification
      const phoneToken = await service.createPhoneVerification(account.$id)
      expect(phoneToken.secret).toBeDefined()
      const verifiedPhone = await service.updatePhoneVerification(
        account.$id,
        phoneToken.secret ?? '',
      )
      expect(verifiedPhone.$id).toBe(phoneToken.$id)

      // Status
      const blocked = await service.updateStatus(account.$id)
      expect(blocked.status).toBe(false)
    })
  })

  describe('AccountSessionsService', () => {
    it('creates email sessions and authenticates valid credentials', async () => {
      const { session } = createInMemorySession()
      const accountService = new AccountService(session)
      const sessionService = new AccountSessionsService(session, 'test-jwt-secret')

      await accountService.createAccount({
        email: 'login@example.com',
        password: 'SecurePass123!',
      })

      const login = await sessionService.createEmailSession({
        email: 'login@example.com',
        password: 'SecurePass123!',
      })
      expect(login.session.userId).toBeDefined()
      expect(login.secret).toBeDefined()

      await expect(
        sessionService.createEmailSession({
          email: 'login@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedError)

      // Session listing and getting
      const list = await sessionService.getSessions(login.userId, login.session.$id)
      expect(list.total).toBe(1)
      expect(list.sessions[0]?.current).toBe(true)

      const single = await sessionService.getSession(
        login.userId,
        login.session.$id,
        login.session.$id,
      )
      expect(single.$id).toBe(login.session.$id)

      // JWT
      const jwt = await sessionService.createJWT(login.userId, login.session.$id)
      expect(jwt.jwt).toBeDefined()

      // Delete session
      await sessionService.deleteSession(login.userId, login.session.$id)
      const listAfter = await sessionService.getSessions(login.userId)
      expect(listAfter.total).toBe(0)
    })

    it('creates anonymous sessions and token sessions', async () => {
      const { session } = createInMemorySession()
      const sessionService = new AccountSessionsService(session)

      const anon = await sessionService.createAnonymousSession({})
      expect(anon.userId).toBeDefined()
      expect(anon.session.provider).toBe('anonymous')

      const magicToken = await sessionService.createMagicURLToken({
        email: 'magic@example.com',
      })
      expect(magicToken.secret).toBeDefined()

      const magicSession = await sessionService.createSessionWithToken({
        userId: magicToken.userId,
        secret: magicToken.secret ?? '',
      })
      expect(magicSession.session.provider).toBe('magic-url')
    })
  })

  describe('AccountRecoveryService', () => {
    it('creates and confirms password recovery', async () => {
      const { session } = createInMemorySession()
      const accountService = new AccountService(session)
      const recoveryService = new AccountRecoveryService(session)
      const sessionService = new AccountSessionsService(session)

      const user = await accountService.createAccount({
        email: 'recover@example.com',
        password: 'OldPassword123!',
      })

      const token = await recoveryService.createRecovery({ email: 'recover@example.com' })
      expect(token.secret).toBeDefined()

      await recoveryService.updateRecovery({
        userId: user.$id,
        secret: token.secret ?? '',
        password: 'BrandNewPassword456!',
      })

      // Verify login with new password works
      const login = await sessionService.createEmailSession({
        email: 'recover@example.com',
        password: 'BrandNewPassword456!',
      })
      expect(login.userId).toBe(user.$id)
    })
  })

  describe('AccountTargetsService', () => {
    it('manages push targets', async () => {
      const { session } = createInMemorySession()
      const accountService = new AccountService(session)
      const targetService = new AccountTargetsService(session)

      const user = await accountService.createAccount({
        email: 'push@example.com',
        password: 'SecurePassword123!',
      })

      const target = await targetService.createPushTarget({
        userId: user.$id,
        identifier: 'fcm-device-token-123',
        name: 'Pixel 9',
      })
      expect(target.identifier).toBe('fcm-device-token-123')
      expect(target.name).toBe('Pixel 9')

      const updated = await targetService.updatePushTarget({
        userId: user.$id,
        targetId: target.$id,
        name: 'Pixel 9 Pro',
      })
      expect(updated.name).toBe('Pixel 9 Pro')

      await targetService.deletePushTarget(user.$id, target.$id)
    })
  })

  describe('AccountMfaService', () => {
    it('manages TOTP authenticator enrollment, factors, and recovery codes', async () => {
      const { session } = createInMemorySession()
      const accountService = new AccountService(session)
      const mfaService = new AccountMfaService(session)

      const user = await accountService.createAccount({
        email: 'mfa@example.com',
        password: 'SecurePassword123!',
      })

      // Authenticator
      const auth = await mfaService.createMfaAuthenticator(user.$id, 'totp')
      expect(auth.secret).toBeDefined()
      expect(auth.uri).toContain('otpauth://totp/')

      // Recovery codes
      const codes = await mfaService.createMfaRecoveryCodes(user.$id)
      expect(codes.recoveryCodes.length).toBe(6)

      const storedCodes = await mfaService.getMfaRecoveryCodes(user.$id)
      expect(storedCodes.recoveryCodes.length).toBe(6)

      // Factors
      const factors = await mfaService.getMfaFactors(user.$id)
      expect(factors.recoveryCode).toBe(true)

      // MFA challenge with recovery code
      const challenge = await mfaService.createMfaChallenge({
        userId: user.$id,
        factor: 'recoveryCode',
      })
      expect(challenge.challengeId).toBeDefined()

      await mfaService.updateMfaChallenge({
        userId: user.$id,
        challengeId: challenge.challengeId,
        otp: codes.recoveryCodes[0] ?? '',
      })

      // Update MFA enabled
      const mfaEnabled = await mfaService.updateMfa(user.$id, true)
      expect(mfaEnabled.mfa).toBe(true)
    })
  })

  describe('AccountIdentitiesService', () => {
    it('lists and deletes identities', async () => {
      const { session } = createInMemorySession()
      const identitiesService = new AccountIdentitiesService(session)

      await session.createDocument(
        'identities',
        new Doc({
          $id: 'ident_1',
          userId: 'user_1',
          provider: 'google',
          providerEmail: 'google@example.com',
        }),
      )

      const list = await identitiesService.getIdentities('user_1')
      expect(list.total).toBe(1)
      expect(list.identities[0]?.provider).toBe('google')

      await identitiesService.deleteIdentity('user_1', 'ident_1')
      const listAfter = await identitiesService.getIdentities('user_1')
      expect(listAfter.total).toBe(0)
    })
  })
})
