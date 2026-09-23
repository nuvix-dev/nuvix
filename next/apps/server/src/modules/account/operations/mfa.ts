import {
  generateOtp,
  generateRecoveryCodes,
  generateTotpSecret,
  generateTotpUri,
  verifyTotp,
} from '@nuvix/core/auth'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../../shared/errors'
import type { Authenticators, Challenges, UsersDoc } from '../../../types/generated'

export interface MfaFactors {
  totp: boolean
  email: boolean
  phone: boolean
  recoveryCode: boolean
}

export interface TotpAuthenticatorResult {
  secret: string
  uri: string
}

export async function updateMfa(
  session: Session,
  userId: string,
  mfa: boolean,
  currentSessionId?: string,
): Promise<UsersDoc> {
  const user = await session.getDocument('users', userId)
  if (user.empty()) {
    throw new NotFoundError('User not found', { code: 'user_not_found' })
  }

  user.set('mfa', mfa)
  const updated = await session.updateDocument('users', userId, user)

  if (mfa && currentSessionId) {
    const sess = await session.getDocument('sessions', currentSessionId)
    if (!sess.empty()) {
      const factors: string[] = (sess.get('factors') ?? []) as string[]
      const totpAuth = await session.findOne('authenticators', [
        Query.equal('userId', [userId]),
        Query.equal('type', ['totp']),
      ])
      if (!totpAuth.empty() && totpAuth.get('verified')) {
        factors.push('totp')
      }
      if (user.get('email') && user.get('emailVerification')) {
        factors.push('email')
      }
      if (user.get('phone') && user.get('phoneVerification')) {
        factors.push('phone')
      }

      sess.set('factors', [...new Set(factors)])
      await session.updateDocument('sessions', currentSessionId, sess)
    }
  }

  return updated
}

export async function getMfaFactors(session: Session, userId: string): Promise<MfaFactors> {
  const user = await session.getDocument('users', userId)
  if (user.empty()) {
    throw new NotFoundError('User not found', { code: 'user_not_found' })
  }

  const totpAuth = await session.findOne('authenticators', [
    Query.equal('userId', [userId]),
    Query.equal('type', ['totp']),
  ])
  const totpVerified = !totpAuth.empty() && Boolean(totpAuth.get('verified'))

  const recoveryCodes = (user.get('mfaRecoveryCodes') ?? []) as string[]
  const hasRecoveryCodes = recoveryCodes.length > 0

  return {
    totp: totpVerified,
    email: Boolean(user.get('email') && user.get('emailVerification')),
    phone: Boolean(user.get('phone') && user.get('phoneVerification')),
    recoveryCode: hasRecoveryCodes,
  }
}

export async function createTotpAuthenticator(
  session: Session,
  userId: string,
  issuer = 'Nuvix',
): Promise<TotpAuthenticatorResult> {
  const user = await session.getDocument('users', userId)
  if (user.empty()) {
    throw new NotFoundError('User not found', { code: 'user_not_found' })
  }

  const existing = await session.findOne('authenticators', [
    Query.equal('userId', [userId]),
    Query.equal('type', ['totp']),
  ])

  if (!existing.empty()) {
    if (existing.get('verified')) {
      throw new ConflictError('Authenticator already verified', {
        code: 'user_authenticator_already_verified',
      })
    }
    await session.deleteDocument('authenticators', existing.getId())
  }

  const secret = generateTotpSecret(20)
  const label = (user.get('email') as string) || userId
  const uri = generateTotpUri(label, issuer, secret)

  const authData: Authenticators = {
    $id: ID.unique(),
    $createdAt: null,
    $updatedAt: null,
    $permissions: [
      Permission.read(Role.user(userId)).toString(),
      Permission.update(Role.user(userId)).toString(),
      Permission.delete(Role.user(userId)).toString(),
    ],
    $sequence: 0,
    $collection: 'authenticators',
    userId,
    type: 'totp',
    verified: false,
    data: JSON.stringify({ secret }),
  }

  await session.createDocument('authenticators', new Doc<Authenticators>(authData))
  return { secret, uri }
}

export async function verifyTotpAuthenticator(
  session: Session,
  userId: string,
  otp: string,
  currentSessionId?: string,
): Promise<void> {
  const authenticator = await session.findOne('authenticators', [
    Query.equal('userId', [userId]),
    Query.equal('type', ['totp']),
  ])

  if (authenticator.empty()) {
    throw new NotFoundError('Authenticator not found', {
      code: 'user_authenticator_not_found',
    })
  }

  if (authenticator.get('verified')) {
    throw new ConflictError('Authenticator already verified', {
      code: 'user_authenticator_already_verified',
    })
  }

  const dataStr = authenticator.get('data') as string
  let secret = ''
  try {
    const parsed = JSON.parse(dataStr)
    secret = parsed.secret ?? ''
  } catch {
    secret = ''
  }

  const isValid = await verifyTotp(otp, secret)
  if (!isValid) {
    throw new UnauthorizedError('Invalid token', { code: 'user_invalid_token' })
  }

  authenticator.set('verified', true)
  await session.updateDocument('authenticators', authenticator.getId(), authenticator)

  if (currentSessionId) {
    const sess = await session.getDocument('sessions', currentSessionId)
    if (!sess.empty()) {
      const factors: string[] = (sess.get('factors') ?? []) as string[]
      factors.push('totp')
      sess.set('factors', [...new Set(factors)])
      await session.updateDocument('sessions', currentSessionId, sess)
    }
  }
}

export async function deleteTotpAuthenticator(session: Session, userId: string): Promise<void> {
  const authenticator = await session.findOne('authenticators', [
    Query.equal('userId', [userId]),
    Query.equal('type', ['totp']),
  ])

  if (authenticator.empty()) {
    throw new NotFoundError('Authenticator not found', {
      code: 'user_authenticator_not_found',
    })
  }

  await session.deleteDocument('authenticators', authenticator.getId())
}

export async function createRecoveryCodes(
  session: Session,
  userId: string,
): Promise<{ recoveryCodes: string[] }> {
  const user = await session.getDocument('users', userId)
  if (user.empty()) {
    throw new NotFoundError('User not found', { code: 'user_not_found' })
  }

  const existing = (user.get('mfaRecoveryCodes') ?? []) as string[]
  if (existing.length > 0) {
    throw new ConflictError('Recovery codes already exist', {
      code: 'user_recovery_codes_already_exists',
    })
  }

  const codes = generateRecoveryCodes(6, 10)
  user.set('mfaRecoveryCodes', codes)
  await session.updateDocument('users', userId, user)

  return { recoveryCodes: codes }
}

export async function updateRecoveryCodes(
  session: Session,
  userId: string,
): Promise<{ recoveryCodes: string[] }> {
  const user = await session.getDocument('users', userId)
  if (user.empty()) {
    throw new NotFoundError('User not found', { code: 'user_not_found' })
  }

  const existing = (user.get('mfaRecoveryCodes') ?? []) as string[]
  if (existing.length === 0) {
    throw new NotFoundError('Recovery codes not found', {
      code: 'user_recovery_codes_not_found',
    })
  }

  const codes = generateRecoveryCodes(6, 10)
  user.set('mfaRecoveryCodes', codes)
  await session.updateDocument('users', userId, user)

  return { recoveryCodes: codes }
}

export async function getRecoveryCodes(
  session: Session,
  userId: string,
): Promise<{ recoveryCodes: string[] }> {
  const user = await session.getDocument('users', userId)
  if (user.empty()) {
    throw new NotFoundError('User not found', { code: 'user_not_found' })
  }

  const existing = (user.get('mfaRecoveryCodes') ?? []) as string[]
  if (existing.length === 0) {
    throw new NotFoundError('Recovery codes not found', {
      code: 'user_recovery_codes_not_found',
    })
  }

  return { recoveryCodes: existing }
}

export async function createMfaChallenge(
  session: Session,
  userId: string,
  factor: 'email' | 'phone' | 'totp' | 'recoveryCode',
): Promise<{ challengeId: string }> {
  const user = await session.getDocument('users', userId)
  if (user.empty()) {
    throw new NotFoundError('User not found', { code: 'user_not_found' })
  }

  let code: string | undefined
  if (factor === 'email') {
    if (!user.get('email')) {
      throw new BadRequestError('Email not found', { code: 'user_email_not_found' })
    }
    if (!user.get('emailVerification')) {
      throw new UnauthorizedError('Email not verified', { code: 'user_email_not_verified' })
    }
    code = generateOtp(6)
  } else if (factor === 'phone') {
    if (!user.get('phone')) {
      throw new BadRequestError('Phone not found', { code: 'user_phone_not_found' })
    }
    if (!user.get('phoneVerification')) {
      throw new UnauthorizedError('Phone not verified', { code: 'user_phone_not_verified' })
    }
    code = generateOtp(6)
  } else if (factor === 'totp') {
    const totpAuth = await session.findOne('authenticators', [
      Query.equal('userId', [userId]),
      Query.equal('type', ['totp']),
    ])
    if (totpAuth.empty() || !totpAuth.get('verified')) {
      throw new NotFoundError('Authenticator not found', {
        code: 'user_authenticator_not_found',
      })
    }
  } else if (factor === 'recoveryCode') {
    const codes = (user.get('mfaRecoveryCodes') ?? []) as string[]
    if (codes.length === 0) {
      throw new NotFoundError('Recovery codes not found', {
        code: 'user_recovery_codes_not_found',
      })
    }
  }

  const challengeId = ID.unique()
  const expire = new Date(Date.now() + 15 * 60 * 1000)

  const challengeData: Challenges = {
    $id: challengeId,
    $createdAt: null,
    $updatedAt: null,
    $permissions: [
      Permission.read(Role.user(userId)).toString(),
      Permission.update(Role.user(userId)).toString(),
      Permission.delete(Role.user(userId)).toString(),
    ],
    $sequence: 0,
    $collection: 'challenges',
    userId,
    type: factor,
    code,
    expire,
  }

  await session.createDocument('challenges', new Doc<Challenges>(challengeData))
  return { challengeId }
}

export async function verifyMfaChallenge(
  session: Session,
  userId: string,
  challengeId: string,
  otp: string,
  currentSessionId?: string,
): Promise<void> {
  const challenge = await session.getDocument('challenges', challengeId)
  if (challenge.empty() || challenge.get('userId') !== userId) {
    throw new NotFoundError('Challenge not found', { code: 'user_challenge_not_found' })
  }

  const expire = challenge.get('expire')
  if (expire && new Date(expire instanceof Date ? expire : String(expire)).getTime() < Date.now()) {
    throw new UnauthorizedError('Invalid or expired token', { code: 'user_invalid_token' })
  }

  const factor = challenge.get('type') as string
  const user = await session.getDocument('users', userId)

  if (factor === 'email' || factor === 'phone') {
    const expected = challenge.get('code')
    if (!expected || otp !== expected) {
      throw new UnauthorizedError('Invalid token', { code: 'user_invalid_token' })
    }
  } else if (factor === 'totp') {
    const totpAuth = await session.findOne('authenticators', [
      Query.equal('userId', [userId]),
      Query.equal('type', ['totp']),
    ])
    if (totpAuth.empty() || !totpAuth.get('verified')) {
      throw new NotFoundError('Authenticator not found', {
        code: 'user_authenticator_not_found',
      })
    }
    const dataStr = totpAuth.get('data') as string
    let secret = ''
    try {
      secret = JSON.parse(dataStr).secret ?? ''
    } catch {
      secret = ''
    }
    const valid = await verifyTotp(otp, secret)
    if (!valid) {
      throw new UnauthorizedError('Invalid token', { code: 'user_invalid_token' })
    }
  } else if (factor === 'recoveryCode') {
    const codes = (user.get('mfaRecoveryCodes') ?? []) as string[]
    const idx = codes.indexOf(otp)
    if (idx === -1) {
      throw new UnauthorizedError('Invalid token', { code: 'user_invalid_token' })
    }
    codes.splice(idx, 1)
    user.set('mfaRecoveryCodes', codes)
    await session.updateDocument('users', userId, user)
  }

  await session.deleteDocument('challenges', challengeId)

  if (currentSessionId) {
    const sess = await session.getDocument('sessions', currentSessionId)
    if (!sess.empty()) {
      const factors: string[] = (sess.get('factors') ?? []) as string[]
      factors.push(factor)
      sess.set('factors', [...new Set(factors)])
      await session.updateDocument('sessions', currentSessionId, sess)
    }
  }
}
