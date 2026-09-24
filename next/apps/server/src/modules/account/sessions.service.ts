import { Auth, type HashAlgorithm } from '@nuvix/core/auth'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors'
import type {
  Sessions,
  SessionsDoc,
  Tokens,
  TokensDoc,
  Users,
  UsersDoc,
} from '../../types/generated'
import { signJwt } from '../../utils/jwt'
import { formatSession, formatToken, type SessionView, type TokenView } from './formatter'

export const TokenType = {
  VERIFICATION: 1,
  PHONE: 2,
  RECOVERY: 3,
  MAGIC_URL: 4,
  EMAIL_OTP: 5,
} as const

export interface CreateEmailSessionInput {
  email: string
  password: string
  ip?: string
  userAgent?: string
}

export interface CreateSessionTokenInput {
  userId: string
  secret: string
  ip?: string
  userAgent?: string
}

export interface CreateMagicURLTokenInput {
  userId?: string
  email: string
  url?: string
  ip?: string
  userAgent?: string
}

export interface CreateEmailTokenInput {
  userId?: string
  email: string
  ip?: string
  userAgent?: string
}

export interface CreatePhoneTokenInput {
  userId?: string
  phone: string
  ip?: string
  userAgent?: string
}

export interface SessionResult {
  session: SessionView
  secret: string
  userId: string
}

export class AccountSessionsService {
  constructor(
    private readonly session: Session,
    private readonly jwtSecret?: string,
  ) {}

  async getSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<{ total: number; sessions: SessionView[] }> {
    const docs = (await this.session.find('sessions', [
      Query.equal('userId', [userId]),
    ])) as SessionsDoc[]

    return {
      total: docs.length,
      sessions: docs.map((doc) => {
        const view = formatSession(doc)
        view.current = Boolean(currentSessionId && doc.getId() === currentSessionId)
        return view
      }),
    }
  }

  async getSession(
    userId: string,
    sessionId: string,
    currentSessionId?: string,
  ): Promise<SessionView> {
    const targetId = sessionId === 'current' ? currentSessionId : sessionId
    if (!targetId) {
      throw new NotFoundError('Session not found', { code: 'user_session_not_found' })
    }

    const doc = (await this.session.getDocument('sessions', targetId)) as SessionsDoc
    if (doc.empty() || doc.get('userId') !== userId) {
      throw new NotFoundError('Session not found', { code: 'user_session_not_found' })
    }

    const view = formatSession(doc)
    view.current = Boolean(currentSessionId && doc.getId() === currentSessionId)
    return view
  }

  async deleteSession(userId: string, sessionId: string, currentSessionId?: string): Promise<void> {
    const targetId = sessionId === 'current' ? currentSessionId : sessionId
    if (!targetId) {
      throw new NotFoundError('Session not found', { code: 'user_session_not_found' })
    }

    const doc = (await this.session.getDocument('sessions', targetId)) as SessionsDoc
    if (doc.empty() || doc.get('userId') !== userId) {
      throw new NotFoundError('Session not found', { code: 'user_session_not_found' })
    }

    await this.session.deleteDocument('sessions', targetId)
  }

  async deleteSessions(userId: string): Promise<void> {
    const docs = (await this.session.find('sessions', [
      Query.equal('userId', [userId]),
    ])) as SessionsDoc[]

    for (const doc of docs) {
      await this.session.deleteDocument('sessions', doc.getId())
    }
  }

  async updateSession(
    userId: string,
    sessionId: string,
    currentSessionId?: string,
  ): Promise<SessionView> {
    const targetId = sessionId === 'current' ? currentSessionId : sessionId
    if (!targetId) {
      throw new NotFoundError('Session not found', { code: 'user_session_not_found' })
    }

    const doc = (await this.session.getDocument('sessions', targetId)) as SessionsDoc
    if (doc.empty() || doc.get('userId') !== userId) {
      throw new NotFoundError('Session not found', { code: 'user_session_not_found' })
    }

    const newExpire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_LOGIN_LONG * 1000)
    doc.set('expire', newExpire)
    const updated = (await this.session.updateDocument('sessions', targetId, doc)) as SessionsDoc

    const view = formatSession(updated)
    view.current = Boolean(currentSessionId && targetId === currentSessionId)
    return view
  }

  async createEmailSession(input: CreateEmailSessionInput): Promise<SessionResult> {
    const email = input.email.toLowerCase()
    const user = (await this.session.findOne('users', [Query.equal('email', [email])])) as UsersDoc

    if (user.empty() || !user.get('passwordUpdate')) {
      throw new UnauthorizedError('Invalid credentials', {
        code: 'user_invalid_credentials',
      })
    }

    const valid = await Auth.passwordVerify(
      input.password,
      user.get('password') ?? '',
      (user.get('hash') as HashAlgorithm) ?? Auth.DEFAULT_ALGO,
    )
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials', {
        code: 'user_invalid_credentials',
      })
    }

    if (user.get('status') === false) {
      throw new ForbiddenError('User is blocked', { code: 'user_blocked' })
    }

    // Rehash password if algorithm outdated
    if ((user.get('hash') as HashAlgorithm) !== Auth.DEFAULT_ALGO) {
      const newHash = await Auth.passwordHash(input.password, Auth.DEFAULT_ALGO)
      user.set('password', newHash)
      user.set('hash', Auth.DEFAULT_ALGO)
      user.set('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)
      await this.session.updateDocument('users', user.getId(), user)
    }

    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_LOGIN_LONG * 1000)

    const sessionDoc = new Doc<Sessions>({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ],
      userId: user.getId(),
      userInternalId: user.getSequence(),
      provider: 'email',
      providerUid: email,
      secret: Auth.hash(secret),
      expire,
      userAgent: input.userAgent ?? 'UNKNOWN',
      ip: input.ip ?? '127.0.0.1',
      factors: ['password'],
    })

    const created = (await this.session.createDocument('sessions', sessionDoc)) as SessionsDoc
    const view = formatSession(created)
    view.current = true

    return {
      session: view,
      secret,
      userId: user.getId(),
    }
  }

  async createAnonymousSession(input: { ip?: string; userAgent?: string }): Promise<SessionResult> {
    const userId = ID.unique()
    const userDoc = new Doc<Users>({
      $id: userId,
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ],
      emailVerification: false,
      phoneVerification: false,
      status: true,
      hash: Auth.DEFAULT_ALGO,
      hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
      registration: new Date(),
      reset: false,
      mfa: false,
      prefs: {},
      search: userId,
      accessedAt: new Date(),
    })

    const createdUser = (await this.session.createDocument('users', userDoc)) as UsersDoc

    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_LOGIN_LONG * 1000)

    const sessionDoc = new Doc<Sessions>({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ],
      userId,
      userInternalId: createdUser.getSequence(),
      provider: 'anonymous',
      secret: Auth.hash(secret),
      expire,
      userAgent: input.userAgent ?? 'UNKNOWN',
      ip: input.ip ?? '127.0.0.1',
      factors: ['anonymous'],
    })

    const createdSession = (await this.session.createDocument(
      'sessions',
      sessionDoc,
    )) as SessionsDoc
    const view = formatSession(createdSession)
    view.current = true

    return {
      session: view,
      secret,
      userId,
    }
  }

  async createSessionWithToken(input: CreateSessionTokenInput): Promise<SessionResult> {
    const user = (await this.session.getDocument('users', input.userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const tokens = (await this.session.find('tokens', [
      Query.equal('userId', [input.userId]),
    ])) as TokensDoc[]

    const verified = Auth.tokenVerify(tokens, null, input.secret)
    if (!verified) {
      throw new BadRequestError('Invalid token', { code: 'user_invalid_token' })
    }

    const tokenType = verified.get('type')
    if (tokenType === TokenType.MAGIC_URL || tokenType === TokenType.EMAIL_OTP) {
      user.set('emailVerification', true)
      await this.session.updateDocument('users', user.getId(), user)
    } else if (tokenType === TokenType.PHONE) {
      user.set('phoneVerification', true)
      await this.session.updateDocument('users', user.getId(), user)
    }

    await this.session.deleteDocument('tokens', verified.getId())

    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_LOGIN_LONG * 1000)

    const provider =
      tokenType === TokenType.PHONE
        ? 'phone'
        : tokenType === TokenType.MAGIC_URL
          ? 'magic-url'
          : 'email'
    const factor = tokenType === TokenType.PHONE ? 'phone' : 'email'

    const sessionDoc = new Doc<Sessions>({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ],
      userId: user.getId(),
      userInternalId: user.getSequence(),
      provider,
      secret: Auth.hash(secret),
      expire,
      userAgent: input.userAgent ?? 'UNKNOWN',
      ip: input.ip ?? '127.0.0.1',
      factors: [factor],
    })

    const created = (await this.session.createDocument('sessions', sessionDoc)) as SessionsDoc
    const view = formatSession(created)
    view.current = true

    return {
      session: view,
      secret,
      userId: user.getId(),
    }
  }

  async createMagicURLToken(input: CreateMagicURLTokenInput): Promise<TokenView> {
    const email = input.email.toLowerCase()
    let user = (await this.session.findOne('users', [Query.equal('email', [email])])) as UsersDoc

    if (user.empty()) {
      const userId =
        input.userId && input.userId !== 'unique()' ? ID.custom(input.userId) : ID.unique()
      user = (await this.session.createDocument(
        'users',
        new Doc<Users>({
          $id: userId,
          $permissions: [
            Permission.read(Role.any()),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
          ],
          email,
          emailVerification: false,
          phoneVerification: false,
          status: true,
          hash: Auth.DEFAULT_ALGO,
          hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
          registration: new Date(),
          reset: false,
          mfa: false,
          prefs: {},
          search: `${userId} ${email}`,
          accessedAt: new Date(),
        }),
      )) as UsersDoc
    }

    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_MAGIC_URL)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_CONFIRM * 1000)

    const tokenDoc = (await this.session.createDocument(
      'tokens',
      new Doc<Tokens>({
        $id: ID.unique(),
        $permissions: [
          Permission.read(Role.user(user.getId())),
          Permission.update(Role.user(user.getId())),
          Permission.delete(Role.user(user.getId())),
        ],
        userId: user.getId(),
        userInternalId: user.getSequence(),
        type: TokenType.MAGIC_URL,
        secret: Auth.hash(secret),
        expire,
        userAgent: input.userAgent ?? 'UNKNOWN',
        ip: input.ip ?? '127.0.0.1',
      }),
    )) as TokensDoc

    const formatted = formatToken(tokenDoc)
    formatted.secret = secret
    return formatted
  }

  async createEmailToken(input: CreateEmailTokenInput): Promise<TokenView> {
    const email = input.email.toLowerCase()
    let user = (await this.session.findOne('users', [Query.equal('email', [email])])) as UsersDoc

    if (user.empty()) {
      const userId =
        input.userId && input.userId !== 'unique()' ? ID.custom(input.userId) : ID.unique()
      user = (await this.session.createDocument(
        'users',
        new Doc<Users>({
          $id: userId,
          $permissions: [
            Permission.read(Role.any()),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
          ],
          email,
          emailVerification: false,
          phoneVerification: false,
          status: true,
          hash: Auth.DEFAULT_ALGO,
          hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
          registration: new Date(),
          reset: false,
          mfa: false,
          prefs: {},
          search: `${userId} ${email}`,
          accessedAt: new Date(),
        }),
      )) as UsersDoc
    }

    const secret = Auth.codeGenerator(6)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_OTP * 1000)

    const tokenDoc = (await this.session.createDocument(
      'tokens',
      new Doc<Tokens>({
        $id: ID.unique(),
        $permissions: [
          Permission.read(Role.user(user.getId())),
          Permission.update(Role.user(user.getId())),
          Permission.delete(Role.user(user.getId())),
        ],
        userId: user.getId(),
        userInternalId: user.getSequence(),
        type: TokenType.EMAIL_OTP,
        secret: Auth.hash(secret),
        expire,
        userAgent: input.userAgent ?? 'UNKNOWN',
        ip: input.ip ?? '127.0.0.1',
      }),
    )) as TokensDoc

    const formatted = formatToken(tokenDoc)
    formatted.secret = secret
    return formatted
  }

  async createPhoneToken(input: CreatePhoneTokenInput): Promise<TokenView> {
    let user = (await this.session.findOne('users', [
      Query.equal('phone', [input.phone]),
    ])) as UsersDoc

    if (user.empty()) {
      const userId =
        input.userId && input.userId !== 'unique()' ? ID.custom(input.userId) : ID.unique()
      user = (await this.session.createDocument(
        'users',
        new Doc<Users>({
          $id: userId,
          $permissions: [
            Permission.read(Role.any()),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
          ],
          phone: input.phone,
          emailVerification: false,
          phoneVerification: false,
          status: true,
          hash: Auth.DEFAULT_ALGO,
          hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
          registration: new Date(),
          reset: false,
          mfa: false,
          prefs: {},
          search: `${userId} ${input.phone}`,
          accessedAt: new Date(),
        }),
      )) as UsersDoc
    }

    const secret = Auth.codeGenerator(6)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_OTP * 1000)

    const tokenDoc = (await this.session.createDocument(
      'tokens',
      new Doc<Tokens>({
        $id: ID.unique(),
        $permissions: [
          Permission.read(Role.user(user.getId())),
          Permission.update(Role.user(user.getId())),
          Permission.delete(Role.user(user.getId())),
        ],
        userId: user.getId(),
        userInternalId: user.getSequence(),
        type: TokenType.PHONE,
        secret: Auth.hash(secret),
        expire,
        userAgent: input.userAgent ?? 'UNKNOWN',
        ip: input.ip ?? '127.0.0.1',
      }),
    )) as TokensDoc

    const formatted = formatToken(tokenDoc)
    formatted.secret = secret
    return formatted
  }

  async createJWT(userId: string, sessionId?: string): Promise<{ jwt: string }> {
    if (!this.jwtSecret) {
      throw new BadRequestError('JWT is not configured', { code: 'jwt_disabled' })
    }
    const token = await signJwt({ sub: userId, sid: sessionId }, this.jwtSecret, 900)
    return { jwt: token }
  }
}
