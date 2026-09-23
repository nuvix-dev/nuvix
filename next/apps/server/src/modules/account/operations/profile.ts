import { containsPersonalData, verifyPassword } from '@nuvix/core/auth'
import { Query, type Session } from '@nuvix/db'
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
} from '../../../shared/errors'
import { formatSession, type SessionView } from '../../sessions/formatter'
import type { RequestMetadata, SessionSettings } from '../../sessions/operations/create'
import { createSession } from '../../sessions/operations/create'
import { deleteAllUserSessions, deleteSession } from '../../sessions/operations/manage'
import { createUser } from '../../users/operations/create'
import { deleteUser } from '../../users/operations/delete'
import {
  getUserOrThrow,
  updateUserEmail,
  updateUserName,
  updateUserPassword,
  updateUserPhone,
  updateUserPrefs,
  updateUserStatus,
} from '../../users/operations/update'
import { type AccountView, formatAccount } from '../formatter'

export interface CreateAccountInput {
  userId?: string
  email: string
  password: string
  name?: string
}

export interface AccountSettings extends SessionSettings {
  auths?: SessionSettings['auths'] & {
    emailPassword?: boolean
    personalDataCheck?: boolean
    passwordHistory?: number
  }
}

export async function createAccount(
  session: Session,
  input: CreateAccountInput,
  reqMeta: RequestMetadata = {},
  settings: AccountSettings = {},
): Promise<{ account: AccountView; session: SessionView }> {
  if (settings.auths?.emailPassword === false) {
    throw new AppError(501, {
      type: '/errors/bad-request',
      code: 'user_auth_method_unsupported',
      detail: 'Email/password authentication is disabled',
    })
  }

  if (settings.auths?.personalDataCheck) {
    const hasPersonalData = containsPersonalData(input.password, {
      userId: input.userId,
      email: input.email,
      name: input.name,
    })
    if (hasPersonalData) {
      throw new BadRequestError('Password contains personal data and cannot be used', {
        code: 'password_personal_data',
      })
    }
  }

  const { user, targets } = await createUser(session, {
    userId: input.userId,
    email: input.email,
    password: input.password,
    name: input.name,
  })

  const { session: sessionDoc, secret } = await createSession(
    session,
    user.getId(),
    'email',
    input.email,
    ['email'],
    reqMeta,
    settings,
  )

  return {
    account: formatAccount(user, targets),
    session: formatSession(sessionDoc, {
      secret,
      currentSessionId: sessionDoc.getId(),
    }),
  }
}

export async function getAccount(session: Session, userId: string): Promise<AccountView> {
  const user = await getUserOrThrow(session, userId)
  if (user.get('status') === false) {
    throw new UnauthorizedError('Account is blocked', { code: 'user_blocked' })
  }

  const targets = await session.find('targets', [Query.equal('userId', [userId])])

  return formatAccount(user, targets)
}

export async function deleteAccount(session: Session, userId: string): Promise<void> {
  const user = await getUserOrThrow(session, userId)
  if (user.get('status') === false) {
    throw new UnauthorizedError('Account is blocked', { code: 'user_blocked' })
  }

  await deleteUser(session, userId)
}

export async function updateAccountPassword(
  session: Session,
  userId: string,
  currentSessionId: string | undefined,
  input: { password: string; oldPassword?: string },
  settings: AccountSettings = {},
): Promise<AccountView> {
  const user = await getUserOrThrow(session, userId)
  if (user.get('status') === false) {
    throw new UnauthorizedError('Account is blocked', { code: 'user_blocked' })
  }

  const currentHash = user.get('password')
  const passwordUpdate = user.get('passwordUpdate')

  // Only verify oldPassword if the user has an existing password set
  if (currentHash && passwordUpdate !== null && passwordUpdate !== undefined) {
    if (!input.oldPassword || !(await verifyPassword(input.oldPassword, currentHash))) {
      throw new UnauthorizedError('Invalid credentials', {
        code: 'user_invalid_credentials',
      })
    }
  }

  const updatedUser = await updateUserPassword(session, userId, input.password, {
    maxHistory: settings.auths?.passwordHistory,
    personalDataCheck: settings.auths?.personalDataCheck,
  })

  // Revoke all other sessions except the current one (v2 improvement)
  if (currentSessionId) {
    await deleteAllUserSessions(session, userId, currentSessionId)
  }

  const targets = await session.find('targets', [Query.equal('userId', [userId])])

  return formatAccount(updatedUser, targets)
}

export async function updateAccountEmail(
  session: Session,
  userId: string,
  input: { email: string; password?: string },
): Promise<AccountView> {
  const user = await getUserOrThrow(session, userId)
  if (user.get('status') === false) {
    throw new UnauthorizedError('Account is blocked', { code: 'user_blocked' })
  }

  const currentHash = user.get('password')
  const passwordUpdate = user.get('passwordUpdate')

  if (currentHash && passwordUpdate !== null && passwordUpdate !== undefined) {
    if (!input.password || !(await verifyPassword(input.password, currentHash))) {
      throw new UnauthorizedError('Invalid credentials', {
        code: 'user_invalid_credentials',
      })
    }
  }

  const { user: updatedUser, targets } = await updateUserEmail(session, userId, input.email)

  return formatAccount(updatedUser, targets)
}

export async function updateAccountPhone(
  session: Session,
  userId: string,
  input: { phone: string; password?: string },
): Promise<AccountView> {
  const user = await getUserOrThrow(session, userId)
  if (user.get('status') === false) {
    throw new UnauthorizedError('Account is blocked', { code: 'user_blocked' })
  }

  const currentHash = user.get('password')
  const passwordUpdate = user.get('passwordUpdate')

  if (currentHash && passwordUpdate !== null && passwordUpdate !== undefined) {
    if (!input.password || !(await verifyPassword(input.password, currentHash))) {
      throw new UnauthorizedError('Invalid credentials', {
        code: 'user_invalid_credentials',
      })
    }
  }

  const { user: updatedUser, targets } = await updateUserPhone(session, userId, input.phone)

  return formatAccount(updatedUser, targets)
}

export async function updateAccountName(
  session: Session,
  userId: string,
  name: string,
): Promise<AccountView> {
  const user = await getUserOrThrow(session, userId)
  if (user.get('status') === false) {
    throw new UnauthorizedError('Account is blocked', { code: 'user_blocked' })
  }

  const updated = await updateUserName(session, userId, name)
  const targets = await session.find('targets', [Query.equal('userId', [userId])])

  return formatAccount(updated, targets)
}

export async function updateAccountPrefs(
  session: Session,
  userId: string,
  prefs: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const user = await getUserOrThrow(session, userId)
  if (user.get('status') === false) {
    throw new UnauthorizedError('Account is blocked', { code: 'user_blocked' })
  }

  return updateUserPrefs(session, userId, prefs)
}

export async function blockOwnAccount(
  session: Session,
  userId: string,
  currentSessionId?: string,
): Promise<void> {
  await updateUserStatus(session, userId, false)

  if (currentSessionId) {
    try {
      await deleteSession(session, currentSessionId)
    } catch {
      // Best-effort
    }
  }
}
