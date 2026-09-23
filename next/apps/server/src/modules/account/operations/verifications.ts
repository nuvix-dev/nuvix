import { generateOtp, generateSecret, hashSecret, TokenType } from '@nuvix/core/auth'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../../../shared/errors'
import type { Tokens, TokensDoc } from '../../../types/generated'
import type { RequestMetadata } from '../../sessions/operations/create'
import { type AccountView, formatAccount } from '../formatter'

export interface VerificationSettings {
  smtpEnabled?: boolean
  smsEnabled?: boolean
  mockNumbers?: Array<{ phone: string; otp: string }>
}

export interface VerificationTokenResult {
  token: TokensDoc
  secret: string
  url?: string
}

function isTokenExpired(doc: TokensDoc): boolean {
  const expire = doc.get('expire')
  if (!expire) return false
  const time = new Date(expire instanceof Date ? expire : String(expire)).getTime()
  return time < Date.now()
}

export async function createEmailVerification(
  session: Session,
  userId: string,
  url?: string,
  reqMeta: RequestMetadata = {},
  settings: VerificationSettings = {},
): Promise<VerificationTokenResult> {
  if (settings.smtpEnabled === false) {
    throw new ServiceUnavailableError('SMTP is disabled', { code: 'general_smtp_disabled' })
  }

  const user = await session.getDocument('users', userId)
  if (user.empty()) {
    throw new NotFoundError('User not found', { code: 'user_not_found' })
  }
  if (user.get('status') === false) {
    throw new UnauthorizedError('User is blocked', { code: 'user_blocked' })
  }
  if (user.get('emailVerification')) {
    throw new ConflictError('Email already verified', { code: 'user_email_already_verified' })
  }

  const secret = generateSecret(32)
  const expire = new Date(Date.now() + 7 * 86400 * 1000)

  const tokenData: Tokens = {
    $id: ID.unique(),
    $createdAt: null,
    $updatedAt: null,
    $permissions: [
      Permission.read(Role.user(userId)).toString(),
      Permission.update(Role.user(userId)).toString(),
      Permission.delete(Role.user(userId)).toString(),
    ],
    $sequence: 0,
    $collection: 'tokens',
    userId,
    type: TokenType.VERIFICATION,
    secretHash: hashSecret(secret),
    expire,
    userAgent: reqMeta.userAgent,
    ip: reqMeta.ip,
  }

  const tokenDoc = await session.createDocument('tokens', new Doc<Tokens>(tokenData))

  let finalUrl: string | undefined
  if (url) {
    const urlObj = new URL(url)
    urlObj.searchParams.set('userId', userId)
    urlObj.searchParams.set('secret', secret)
    urlObj.searchParams.set('expire', expire.toISOString())
    finalUrl = urlObj.toString()
  }

  return { token: tokenDoc, secret, url: finalUrl }
}

export async function confirmEmailVerification(
  session: Session,
  userId: string,
  secret: string,
): Promise<AccountView> {
  const user = await session.getDocument('users', userId)
  if (user.empty()) {
    throw new NotFoundError('User not found', { code: 'user_not_found' })
  }

  const secretHash = hashSecret(secret)
  const token = await session.findOne('tokens', [
    Query.equal('secretHash', [secretHash]),
    Query.equal('type', [TokenType.VERIFICATION]),
  ])

  if (token.empty() || token.get('userId') !== userId || isTokenExpired(token)) {
    throw new UnauthorizedError('Invalid or expired token', { code: 'user_invalid_token' })
  }

  user.set('emailVerification', true)
  const updated = await session.updateDocument('users', userId, user)
  await session.deleteDocument('tokens', token.getId())

  const targets = await session.find('targets', [Query.equal('userId', [userId])])
  return formatAccount(updated, targets)
}

export async function createPhoneVerification(
  session: Session,
  userId: string,
  reqMeta: RequestMetadata = {},
  settings: VerificationSettings = {},
): Promise<VerificationTokenResult> {
  if (settings.smsEnabled === false) {
    throw new ServiceUnavailableError('SMS is disabled', { code: 'general_phone_disabled' })
  }

  const user = await session.getDocument('users', userId)
  if (user.empty()) {
    throw new NotFoundError('User not found', { code: 'user_not_found' })
  }
  if (user.get('status') === false) {
    throw new UnauthorizedError('User is blocked', { code: 'user_blocked' })
  }

  const phone = user.get('phone')
  if (!phone) {
    throw new BadRequestError('Phone number not found', { code: 'user_phone_not_found' })
  }
  if (user.get('phoneVerification')) {
    throw new ConflictError('Phone already verified', { code: 'user_phone_already_verified' })
  }

  let secret: string | undefined
  for (const mock of settings.mockNumbers ?? []) {
    if (mock.phone === phone) {
      secret = mock.otp
      break
    }
  }
  secret ??= generateOtp(6)

  const expire = new Date(Date.now() + 15 * 60 * 1000)

  const tokenData: Tokens = {
    $id: ID.unique(),
    $createdAt: null,
    $updatedAt: null,
    $permissions: [
      Permission.read(Role.user(userId)).toString(),
      Permission.update(Role.user(userId)).toString(),
      Permission.delete(Role.user(userId)).toString(),
    ],
    $sequence: 0,
    $collection: 'tokens',
    userId,
    type: TokenType.PHONE,
    secretHash: hashSecret(secret),
    expire,
    userAgent: reqMeta.userAgent,
    ip: reqMeta.ip,
  }

  const tokenDoc = await session.createDocument('tokens', new Doc<Tokens>(tokenData))
  return { token: tokenDoc, secret }
}

export async function confirmPhoneVerification(
  session: Session,
  userId: string,
  secret: string,
): Promise<AccountView> {
  const user = await session.getDocument('users', userId)
  if (user.empty()) {
    throw new NotFoundError('User not found', { code: 'user_not_found' })
  }

  const secretHash = hashSecret(secret)
  const token = await session.findOne('tokens', [
    Query.equal('secretHash', [secretHash]),
    Query.equal('type', [TokenType.PHONE]),
  ])

  if (token.empty() || token.get('userId') !== userId || isTokenExpired(token)) {
    throw new UnauthorizedError('Invalid or expired token', { code: 'user_invalid_token' })
  }

  user.set('phoneVerification', true)
  const updated = await session.updateDocument('users', userId, user)
  await session.deleteDocument('tokens', token.getId())

  const targets = await session.find('targets', [Query.equal('userId', [userId])])
  return formatAccount(updated, targets)
}
