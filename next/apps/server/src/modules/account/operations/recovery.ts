import {
  containsPersonalData,
  generateSecret,
  hashPassword,
  hashSecret,
  isPasswordRecentlyUsed,
  TokenType,
} from '@nuvix/core/auth'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import {
  BadRequestError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../../../shared/errors'
import type { Tokens, TokensDoc } from '../../../types/generated'
import type { RequestMetadata } from '../../sessions/operations/create'
import { type AccountView, formatAccount } from '../formatter'

export interface RecoverySettings {
  smtpEnabled?: boolean
  passwordHistory?: number
  personalDataCheck?: boolean
}

export interface RecoveryTokenResult {
  token?: TokensDoc
  secret: string
  expire: string
  userId: string
  url?: string
}

function isTokenExpired(doc: TokensDoc): boolean {
  const expire = doc.get('expire')
  if (!expire) return false
  const time = new Date(expire instanceof Date ? expire : String(expire)).getTime()
  return time < Date.now()
}

export async function createPasswordRecovery(
  session: Session,
  email: string,
  url: string,
  reqMeta: RequestMetadata = {},
  settings: RecoverySettings = {},
): Promise<RecoveryTokenResult> {
  if (settings.smtpEnabled === false) {
    throw new ServiceUnavailableError('SMTP is disabled', { code: 'general_smtp_disabled' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const users = await session.find('users', [Query.equal('email', [normalizedEmail])])
  const user = users[0]

  // Anti-enumeration: return dummy response if user does not exist
  if (!user) {
    const fakeExpire = new Date(Date.now() + 3600 * 1000).toISOString()
    return {
      secret: '',
      expire: fakeExpire,
      userId: '',
    }
  }

  if (user.get('status') === false) {
    throw new UnauthorizedError('User is blocked', { code: 'user_blocked' })
  }

  const userId = user.getId()
  const secret = generateSecret(32)
  const expire = new Date(Date.now() + 3600 * 1000)

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
    type: TokenType.RECOVERY,
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

  return {
    token: tokenDoc,
    secret,
    expire: expire.toISOString(),
    userId,
    url: finalUrl,
  }
}

export async function confirmPasswordRecovery(
  session: Session,
  userId: string,
  secret: string,
  password: string,
  settings: RecoverySettings = {},
): Promise<AccountView> {
  const user = await session.getDocument('users', userId)
  if (user.empty()) {
    throw new NotFoundError('User not found', { code: 'user_not_found' })
  }
  if (user.get('status') === false) {
    throw new UnauthorizedError('User is blocked', { code: 'user_blocked' })
  }

  const secretHash = hashSecret(secret)
  const token = await session.findOne('tokens', [
    Query.equal('secretHash', [secretHash]),
    Query.equal('type', [TokenType.RECOVERY]),
  ])

  if (token.empty() || token.get('userId') !== userId || isTokenExpired(token)) {
    throw new UnauthorizedError('Invalid or expired token', { code: 'user_invalid_token' })
  }

  if (
    settings.personalDataCheck &&
    containsPersonalData(password, {
      userId,
      email: user.get('email'),
      name: user.get('name'),
      phone: user.get('phone'),
    })
  ) {
    throw new BadRequestError('Password must not contain personal data', {
      code: 'user_password_personal_data',
    })
  }

  const historyLimit = settings.passwordHistory ?? 0
  const history = (user.get('passwordHistory') ?? []) as string[]
  if (historyLimit > 0 && (await isPasswordRecentlyUsed(password, history, historyLimit))) {
    throw new BadRequestError('Password was recently used', {
      code: 'user_password_recently_used',
    })
  }

  const hashedPassword = await hashPassword(password)
  user.set('password', hashedPassword)
  user.set('passwordUpdate', new Date().toISOString())
  user.set('emailVerification', true)

  if (historyLimit > 0) {
    history.push(hashedPassword)
    user.set('passwordHistory', history.slice(Math.max(0, history.length - historyLimit)))
  }

  const updated = await session.updateDocument('users', userId, user)
  await session.deleteDocument('tokens', token.getId())

  const targets = await session.find('targets', [Query.equal('userId', [userId])])
  return formatAccount(updated, targets)
}
