import { verifyPassword } from '@nuvix/core/auth'
import { Doc, ID, Query, type Session } from '@nuvix/db'
import { AppError, NotFoundError, UnauthorizedError } from '../../../shared/errors'
import type { Users } from '../../../types/generated'
import { signJwt } from '../../../utils/jwt'
import { formatSession, type SessionView } from '../../sessions/formatter'
import type { RequestMetadata, SessionSettings } from '../../sessions/operations/create'
import { createSession } from '../../sessions/operations/create'

export interface LoginSettings extends SessionSettings {
  auths?: SessionSettings['auths'] & {
    emailPassword?: boolean
    anonymous?: boolean
  }
}

export async function loginWithEmail(
  session: Session,
  email: string,
  password: string,
  reqMeta: RequestMetadata = {},
  settings: LoginSettings = {},
): Promise<SessionView> {
  if (settings.auths?.emailPassword === false) {
    throw new AppError(501, {
      type: '/errors/bad-request',
      code: 'user_auth_method_unsupported',
      detail: 'Email/password authentication is disabled',
    })
  }

  const user = await session.findOne('users', [Query.equal('email', [email])])
  if (user.empty()) {
    throw new UnauthorizedError('Invalid credentials', {
      code: 'user_invalid_credentials',
    })
  }

  if (user.get('status') === false) {
    throw new UnauthorizedError('Account is blocked', { code: 'user_blocked' })
  }

  const storedHash = user.get('password')
  if (!storedHash || !(await verifyPassword(password, storedHash))) {
    throw new UnauthorizedError('Invalid credentials', {
      code: 'user_invalid_credentials',
    })
  }

  const { session: sessionDoc, secret } = await createSession(
    session,
    user.getId(),
    'email',
    email,
    ['email'],
    reqMeta,
    settings,
  )

  return formatSession(sessionDoc, {
    secret,
    currentSessionId: sessionDoc.getId(),
  })
}

export async function createAnonymousSession(
  session: Session,
  reqMeta: RequestMetadata = {},
  settings: LoginSettings = {},
): Promise<SessionView> {
  if (settings.auths?.anonymous === false) {
    throw new AppError(501, {
      type: '/errors/bad-request',
      code: 'user_auth_method_unsupported',
      detail: 'Anonymous authentication is disabled',
    })
  }

  const userId = ID.custom(ID.unique())
  const now = new Date().toISOString()

  await session.createDocument(
    'users',
    new Doc<Users>({
      $id: userId,
      name: 'Anonymous User',
      email: '',
      phone: '',
      status: true,
      emailVerification: false,
      phoneVerification: false,
      mfa: false,
      labels: ['anonymous'],
      passwordHistory: [],
      registration: now,
      accessedAt: now,
      prefs: {},
      search: [userId, 'Anonymous User'].join(' '),
    }),
  )

  const { session: sessionDoc, secret } = await createSession(
    session,
    userId,
    'anonymous',
    '',
    ['anonymous'],
    reqMeta,
    settings,
  )

  return formatSession(sessionDoc, {
    secret,
    currentSessionId: sessionDoc.getId(),
  })
}

export async function mintSessionJwt(
  session: Session,
  userId: string,
  sessionId: string,
  jwtSecret: string,
  duration: number = 900,
): Promise<{ jwt: string }> {
  const sessDoc = await session.getDocument('sessions', sessionId)
  if (sessDoc.empty() || sessDoc.get('userId') !== userId) {
    throw new NotFoundError('Session not found', {
      code: 'user_session_not_found',
    })
  }

  const ttl = Math.min(3600, Math.max(60, duration))
  const jwt = await signJwt({ sub: userId, sid: sessionId }, jwtSecret, ttl)

  return { jwt }
}
