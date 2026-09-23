import type { Session } from '@nuvix/db'
import type { SessionView } from '../sessions/formatter'
import type { RequestMetadata } from '../sessions/operations/create'
import type { AccountView } from './formatter'
import {
  createAnonymousSession,
  type LoginSettings,
  loginWithEmail,
  mintSessionJwt,
} from './operations/auth'
import {
  type AccountSettings,
  blockOwnAccount,
  type CreateAccountInput,
  createAccount,
  deleteAccount,
  getAccount,
  updateAccountEmail,
  updateAccountName,
  updateAccountPassword,
  updateAccountPhone,
  updateAccountPrefs,
} from './operations/profile'

export class AccountService {
  constructor(private readonly session: Session) {}

  async create(
    input: CreateAccountInput,
    reqMeta: RequestMetadata = {},
    settings: AccountSettings = {},
  ): Promise<{ account: AccountView; session: SessionView }> {
    return createAccount(this.session, input, reqMeta, settings)
  }

  async get(userId: string): Promise<AccountView> {
    return getAccount(this.session, userId)
  }

  async delete(userId: string): Promise<void> {
    return deleteAccount(this.session, userId)
  }

  async updateName(userId: string, name: string): Promise<AccountView> {
    return updateAccountName(this.session, userId, name)
  }

  async updatePassword(
    userId: string,
    currentSessionId: string | undefined,
    input: { password: string; oldPassword?: string },
    settings: AccountSettings = {},
  ): Promise<AccountView> {
    return updateAccountPassword(this.session, userId, currentSessionId, input, settings)
  }

  async updateEmail(
    userId: string,
    input: { email: string; password?: string },
  ): Promise<AccountView> {
    return updateAccountEmail(this.session, userId, input)
  }

  async updatePhone(
    userId: string,
    input: { phone: string; password?: string },
  ): Promise<AccountView> {
    return updateAccountPhone(this.session, userId, input)
  }

  async updatePrefs(
    userId: string,
    prefs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return updateAccountPrefs(this.session, userId, prefs)
  }

  async blockOwn(userId: string, currentSessionId?: string): Promise<void> {
    return blockOwnAccount(this.session, userId, currentSessionId)
  }

  async loginEmail(
    email: string,
    password: string,
    reqMeta: RequestMetadata = {},
    settings: LoginSettings = {},
  ): Promise<SessionView> {
    return loginWithEmail(this.session, email, password, reqMeta, settings)
  }

  async loginAnonymous(
    reqMeta: RequestMetadata = {},
    settings: LoginSettings = {},
  ): Promise<SessionView> {
    return createAnonymousSession(this.session, reqMeta, settings)
  }

  async mintJwt(
    userId: string,
    sessionId: string,
    jwtSecret: string,
    duration?: number,
  ): Promise<{ jwt: string }> {
    return mintSessionJwt(this.session, userId, sessionId, jwtSecret, duration)
  }
}
