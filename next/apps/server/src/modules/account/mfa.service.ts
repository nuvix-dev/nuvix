import { Auth, generateTotpSecret, getTotpUri, verifyTotpCode } from '@nuvix/core/auth'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import { BadRequestError, NotFoundError } from '../../shared/errors'
import type {
  Authenticators,
  AuthenticatorsDoc,
  Challenges,
  ChallengesDoc,
  SessionsDoc,
  TargetsDoc,
  UsersDoc,
} from '../../types/generated'
import { type AccountView, formatAccount } from './formatter'

export interface MfaFactors {
  totp: boolean
  email: boolean
  phone: boolean
  recoveryCode: boolean
}

export class AccountMfaService {
  constructor(private readonly session: Session) {}

  async updateMfa(userId: string, mfa: boolean, sessionId?: string): Promise<AccountView> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    user.set('mfa', mfa)
    const updated = (await this.session.updateDocument('users', userId, user)) as UsersDoc

    if (mfa && sessionId) {
      const sessionDoc = (await this.session.getDocument('sessions', sessionId)) as SessionsDoc
      if (!sessionDoc.empty()) {
        const factors = (sessionDoc.get('factors') ?? []) as string[]
        if (user.get('emailVerification') && !factors.includes('email')) {
          factors.push('email')
        }
        if (user.get('phoneVerification') && !factors.includes('phone')) {
          factors.push('phone')
        }
        sessionDoc.set('factors', factors)
        await this.session.updateDocument('sessions', sessionId, sessionDoc)
      }
    }

    const targets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
    ])) as TargetsDoc[]
    return formatAccount(updated, targets)
  }

  async getMfaFactors(userId: string): Promise<MfaFactors> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const authenticators = (await this.session.find('authenticators', [
      Query.equal('userId', [userId]),
      Query.equal('type', ['totp']),
      Query.equal('verified', [true]),
    ])) as AuthenticatorsDoc[]

    const recoveryCodes = (user.get('mfaRecoveryCodes') ?? []) as string[]

    return {
      totp: authenticators.length > 0,
      email: Boolean(user.get('emailVerification')),
      phone: Boolean(user.get('phoneVerification')),
      recoveryCode: recoveryCodes.length > 0,
    }
  }

  async createMfaAuthenticator(
    userId: string,
    type: string,
  ): Promise<{ secret: string; uri: string }> {
    if (type !== 'totp') {
      throw new BadRequestError('Unsupported authenticator type', {
        code: 'mfa_type_unsupported',
      })
    }

    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const secret = generateTotpSecret(20)
    const label = user.get('email') || userId
    const uri = getTotpUri({ secret, label, issuer: 'Nuvix' })

    const existing = (await this.session.find('authenticators', [
      Query.equal('userId', [userId]),
      Query.equal('type', ['totp']),
    ])) as AuthenticatorsDoc[]

    if (existing.length > 0 && existing[0]) {
      const doc = existing[0]
      doc.set('data', { secret, uri })
      doc.set('verified', false)
      await this.session.updateDocument('authenticators', doc.getId(), doc)
    } else {
      await this.session.createDocument(
        'authenticators',
        new Doc<Authenticators>({
          $id: ID.unique(),
          $permissions: [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
          ],
          userId,
          userInternalId: user.getSequence(),
          type: 'totp',
          verified: false,
          data: { secret, uri },
        }),
      )
    }

    return { secret, uri }
  }

  async verifyMfaAuthenticator(
    userId: string,
    type: string,
    otp: string,
    sessionId?: string,
  ): Promise<AccountView> {
    if (type !== 'totp') {
      throw new BadRequestError('Unsupported authenticator type', {
        code: 'mfa_type_unsupported',
      })
    }

    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const authenticators = (await this.session.find('authenticators', [
      Query.equal('userId', [userId]),
      Query.equal('type', ['totp']),
    ])) as AuthenticatorsDoc[]

    if (authenticators.length === 0 || !authenticators[0]) {
      throw new NotFoundError('Authenticator not found', {
        code: 'user_authenticator_not_found',
      })
    }

    const authDoc = authenticators[0]
    const data = authDoc.get('data') as { secret?: string } | undefined
    const secret = data?.secret

    if (!secret || !verifyTotpCode(otp, secret)) {
      throw new BadRequestError('Invalid OTP', { code: 'user_invalid_token' })
    }

    authDoc.set('verified', true)
    await this.session.updateDocument('authenticators', authDoc.getId(), authDoc)

    if (sessionId) {
      const sessionDoc = (await this.session.getDocument('sessions', sessionId)) as SessionsDoc
      if (!sessionDoc.empty()) {
        const factors = (sessionDoc.get('factors') ?? []) as string[]
        if (!factors.includes('totp')) {
          factors.push('totp')
        }
        sessionDoc.set('factors', factors)
        await this.session.updateDocument('sessions', sessionId, sessionDoc)
      }
    }

    const targets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
    ])) as TargetsDoc[]
    return formatAccount(user, targets)
  }

  async deleteMfaAuthenticator(userId: string, type: string): Promise<void> {
    const authenticators = (await this.session.find('authenticators', [
      Query.equal('userId', [userId]),
      Query.equal('type', [type]),
    ])) as AuthenticatorsDoc[]

    for (const doc of authenticators) {
      await this.session.deleteDocument('authenticators', doc.getId())
    }
  }

  async createMfaRecoveryCodes(userId: string): Promise<{ recoveryCodes: string[] }> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const codes: string[] = []
    for (let i = 0; i < 6; i++) {
      codes.push(Auth.tokenGenerator(10))
    }

    user.set('mfaRecoveryCodes', codes)
    await this.session.updateDocument('users', userId, user)

    return { recoveryCodes: codes }
  }

  async updateMfaRecoveryCodes(userId: string): Promise<{ recoveryCodes: string[] }> {
    return this.createMfaRecoveryCodes(userId)
  }

  async getMfaRecoveryCodes(userId: string): Promise<{ recoveryCodes: string[] }> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const codes = (user.get('mfaRecoveryCodes') ?? []) as string[]
    if (codes.length === 0) {
      throw new NotFoundError('Recovery codes not found', {
        code: 'user_recovery_codes_not_found',
      })
    }

    return { recoveryCodes: codes }
  }

  async createMfaChallenge(input: {
    userId: string
    factor: string
  }): Promise<{ challengeId: string; factor: string }> {
    const user = (await this.session.getDocument('users', input.userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const challengeId = ID.unique()
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_OTP * 1000)

    const doc = new Doc<Challenges>({
      $id: challengeId,
      $permissions: [
        Permission.read(Role.user(input.userId)),
        Permission.update(Role.user(input.userId)),
        Permission.delete(Role.user(input.userId)),
      ],
      userId: input.userId,
      userInternalId: user.getSequence(),
      type: input.factor,
      expire,
    })

    await this.session.createDocument('challenges', doc)

    return {
      challengeId,
      factor: input.factor,
    }
  }

  async updateMfaChallenge(input: {
    userId: string
    challengeId: string
    otp: string
    sessionId?: string
  }): Promise<void> {
    const challenge = (await this.session.getDocument(
      'challenges',
      input.challengeId,
    )) as ChallengesDoc
    if (challenge.empty() || challenge.get('userId') !== input.userId) {
      throw new NotFoundError('Challenge not found', { code: 'challenge_not_found' })
    }

    const factor = challenge.get('type')
    const user = (await this.session.getDocument('users', input.userId)) as UsersDoc

    if (factor === 'totp') {
      const authenticators = (await this.session.find('authenticators', [
        Query.equal('userId', [input.userId]),
        Query.equal('type', ['totp']),
      ])) as AuthenticatorsDoc[]
      const authDoc = authenticators[0]
      const data = authDoc?.get('data') as { secret?: string } | undefined
      if (!data?.secret || !verifyTotpCode(input.otp, data.secret)) {
        throw new BadRequestError('Invalid OTP', { code: 'user_invalid_token' })
      }
    } else if (factor === 'recoveryCode') {
      const codes = (user.get('mfaRecoveryCodes') ?? []) as string[]
      const idx = codes.indexOf(input.otp)
      if (idx === -1) {
        throw new BadRequestError('Invalid recovery code', { code: 'user_invalid_token' })
      }
      codes.splice(idx, 1)
      user.set('mfaRecoveryCodes', codes)
      await this.session.updateDocument('users', input.userId, user)
    }

    await this.session.deleteDocument('challenges', input.challengeId)

    if (input.sessionId) {
      const sessionDoc = (await this.session.getDocument(
        'sessions',
        input.sessionId,
      )) as SessionsDoc
      if (!sessionDoc.empty()) {
        const factors = (sessionDoc.get('factors') ?? []) as string[]
        if (factor && !factors.includes(factor)) {
          factors.push(factor)
        }
        sessionDoc.set('factors', factors)
        await this.session.updateDocument('sessions', input.sessionId, sessionDoc)
      }
    }
  }
}
