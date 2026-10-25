import { Auth, type HashAlgorithm } from '@nuvix/core/auth'
import { validateRedirectURL } from '@nuvix/core/oauth'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import { generatePhrase } from '@nuvix/utils/phrase'
import type { MailDelivery } from '../../mail/composer'
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
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
import { sessionDetectorFields } from '../../utils/session-intel'
import { formatSession, formatToken, type SessionView, type TokenView } from '../formatter'

/**
 * Token type codes — 1:1 with legacy `TokenType` enum (public API surface:
 * the `type` field appears in token responses, so values must not drift).
 */
export const TokenType = {
  VERIFICATION: 2,
  RECOVERY: 3,
  INVITE: 4,
  MAGIC_URL: 5,
  PHONE: 6,
  OAUTH2: 7,
  GENERIC: 8,
  EMAIL: 9,
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
  /** Enable the security phrase (v1 parity: shown in email + response). */
  phrase?: boolean
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

/** Request-bound session metadata (ip/user-agent) recorded on the session doc. */
export interface SessionIntel {
  ip?: string
  userAgent?: string
}

export interface AccountSessionsOptions {
  /** Rotates upstream provider tokens on OAuth2 sessions during PATCH. */
  refreshOAuth2?: (session: SessionsDoc) => Promise<void>
}

export class AccountSessionsService {
  constructor(
    private readonly session: Session,
    private readonly jwtSecret?: string,
    private readonly options?: AccountSessionsOptions,
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
      throw new NotFoundError('Session not found', {
        code: 'user_session_not_found',
      })
    }

    const doc = (await this.session.getDocument('sessions', targetId)) as SessionsDoc
    if (doc.empty() || doc.get('userId') !== userId) {
      throw new NotFoundError('Session not found', {
        code: 'user_session_not_found',
      })
    }

    const view = formatSession(doc)
    view.current = Boolean(currentSessionId && doc.getId() === currentSessionId)
    return view
  }

  async deleteSession(userId: string, sessionId: string, currentSessionId?: string): Promise<void> {
    const targetId = sessionId === 'current' ? currentSessionId : sessionId
    if (!targetId) {
      throw new NotFoundError('Session not found', {
        code: 'user_session_not_found',
      })
    }

    const doc = (await this.session.getDocument('sessions', targetId)) as SessionsDoc
    if (doc.empty() || doc.get('userId') !== userId) {
      throw new NotFoundError('Session not found', {
        code: 'user_session_not_found',
      })
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
      throw new NotFoundError('Session not found', {
        code: 'user_session_not_found',
      })
    }

    const doc = (await this.session.getDocument('sessions', targetId)) as SessionsDoc
    if (doc.empty() || doc.get('userId') !== userId) {
      throw new NotFoundError('Session not found', {
        code: 'user_session_not_found',
      })
    }

    const newExpire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_LOGIN_LONG * 1000)
    doc.set('expire', newExpire)

    // OAuth2 sessions: rotate the upstream provider tokens while refreshing
    // (contract §PATCH — v2 fix for v1's refresh-token overwrite bug).
    if (this.options?.refreshOAuth2) {
      await this.options.refreshOAuth2(doc)
    }

    const updated = (await this.session.updateDocument('sessions', targetId, doc)) as SessionsDoc

    const view = formatSession(updated)
    view.current = Boolean(currentSessionId && targetId === currentSessionId)
    return view
  }

  async createEmailSession(
    input: CreateEmailSessionInput,
    intel?: SessionIntel,
  ): Promise<SessionResult> {
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
      userAgent: intel?.userAgent ?? input.userAgent ?? 'UNKNOWN',
      ip: intel?.ip ?? input.ip ?? '127.0.0.1',
      factors: ['password'],
      ...sessionDetectorFields(intel?.userAgent ?? input.userAgent),
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

  async createAnonymousSession(
    input: { ip?: string; userAgent?: string } = {},
    intel?: SessionIntel,
  ): Promise<SessionResult> {
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
      userAgent: intel?.userAgent ?? input.userAgent ?? 'UNKNOWN',
      ip: intel?.ip ?? input.ip ?? '127.0.0.1',
      factors: ['anonymous'],
      ...sessionDetectorFields(intel?.userAgent ?? input.userAgent),
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

  async createSessionWithToken(
    input: CreateSessionTokenInput,
    intel?: SessionIntel,
  ): Promise<SessionResult> {
    const user = (await this.session.getDocument('users', input.userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const tokens = (await this.session.find('tokens', [
      Query.equal('userId', [input.userId]),
    ])) as TokensDoc[]

    const verified = Auth.tokenVerify(tokens, null, input.secret)
    if (!verified) {
      throw new BadRequestError('Invalid token', {
        code: 'user_invalid_token',
      })
    }

    const tokenType = verified.get('type')
    if (tokenType === TokenType.MAGIC_URL || tokenType === TokenType.EMAIL) {
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
      userAgent: intel?.userAgent ?? input.userAgent ?? 'UNKNOWN',
      ip: intel?.ip ?? input.ip ?? '127.0.0.1',
      ...sessionDetectorFields(intel?.userAgent ?? input.userAgent),
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

  async createMagicURLToken(
    input: CreateMagicURLTokenInput,
    delivery?: MailDelivery & { origin: string },
  ): Promise<TokenView> {
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

    let phrase: string | undefined
    if (input.phrase === true) {
      phrase = generatePhrase()
    }

    // Validate the redirect against project platforms before spending the
    // token (v1 validates at entry; delivery is required to use this flow).
    if (delivery && input.url) {
      const invalid = validateRedirectURL(input.url, delivery.rules)
      if (invalid) {
        throw new BadRequestError(invalid, { code: 'general_bad_request' })
      }
    }

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

    if (delivery) {
      await sendMagicUrlEmail({
        delivery,
        email,
        userName: String(user.get('name') || 'User'),
        userId: user.getId(),
        secret,
        expire,
        phrase,
        redirectUrl: input.url,
        userAgent: input.userAgent ?? 'UNKNOWN',
      })
    }

    const formatted = formatToken(tokenDoc)
    formatted.secret = secret
    if (phrase) formatted.phrase = phrase
    return formatted
  }

  async createEmailToken(
    input: CreateEmailTokenInput,
    delivery?: MailDelivery & { origin: string },
  ): Promise<TokenView> {
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
        type: TokenType.EMAIL,
        secret: Auth.hash(secret),
        expire,
        userAgent: input.userAgent ?? 'UNKNOWN',
        ip: input.ip ?? '127.0.0.1',
      }),
    )) as TokensDoc

    if (delivery) {
      await sendOtpEmail({
        delivery,
        email,
        userName: String(user.get('name') || 'User'),
        secret,
        userAgent: input.userAgent,
      })
    }

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
      throw new BadRequestError('JWT is not configured', {
        code: 'jwt_disabled',
      })
    }
    const token = await signJwt({ sub: userId, sid: sessionId }, this.jwtSecret, 900)
    return { jwt: token }
  }
}

/**
 * Magic-URL login email (v1 `createMagicURLSession` parity): subject and
 * copy localized, redirect URL carries userId/secret/expire, and the
 * optional security phrase renders in `securityPhrase`.
 */
async function sendMagicUrlEmail(input: {
  delivery: MailDelivery & { origin: string }
  userAgent: string
  email: string
  userName: string
  userId: string
  secret: string
  expire: Date
  phrase?: string
  redirectUrl?: string
}): Promise<void> {
  const { mail, locale } = input.delivery
  if (!mail.enabled) {
    throw new ServiceUnavailableError('SMTP is not configured', {
      code: 'general_smtp_disabled',
    })
  }

  // v1 `magicAuthDefaultPath` fallback when the caller omitted `url`.
  const base = input.redirectUrl || `${input.delivery.origin}/auth/magic-url`
  const url = new URL(base)
  url.searchParams.set('userId', input.userId)
  url.searchParams.set('secret', input.secret)
  url.searchParams.set('expire', input.expire.toISOString())

  const projectName = await mail.projectName()
  const userName = input.userName || 'User'
  const detector = sessionDetectorFields(input.userAgent)
  const agentClient = String(detector.clientName ?? 'UNKNOWN')
  const agentDevice = String(detector.deviceBrand ?? 'UNKNOWN')
  const agentOs = String(detector.osName ?? 'UNKNOWN')

  await mail.build({
    to: input.email,
    templateFile: 'email-magic-url.tpl',
    templateKey: `magicSession-${locale.locale}`,
    subject: locale.format('emails.magicSession.subject', { project: projectName }),
    data: {
      hello: locale.format('emails.magicSession.hello', { user: userName }),
      optionButton: locale.format('emails.magicSession.optionButton', {
        project: projectName,
      }),
      buttonText: locale.format('emails.magicSession.buttonText', {
        project: projectName,
      }),
      optionUrl: locale.format('emails.magicSession.optionUrl'),
      clientInfo: locale.format('emails.magicSession.clientInfo', {
        agentClient,
        agentDevice,
        agentOs,
      }),
      thanks: locale.format('emails.magicSession.thanks'),
      signature: locale.format('emails.magicSession.signature', {
        project: projectName,
      }),
      securityPhrase: input.phrase
        ? locale.format('emails.magicSession.securityPhrase', { phrase: input.phrase })
        : '',
    },
    variables: {
      direction: locale.format('settings.direction'),
      user: userName,
      project: projectName,
      redirect: url.toString(),
    },
  })
}

/**
 * Email OTP message (v1 `createEmailToken` parity): 6-digit code in the
 * `email-otp.tpl` layout with client info from the request user-agent.
 */
async function sendOtpEmail(input: {
  delivery: MailDelivery & { origin: string }
  email: string
  userName: string
  secret: string
  userAgent?: string
}): Promise<void> {
  const { locale } = input.delivery
  const mail = input.delivery.mail
  if (!mail.enabled) {
    throw new ServiceUnavailableError('SMTP is not configured', {
      code: 'general_smtp_disabled',
    })
  }

  const projectName = await mail.projectName()
  const userName = input.userName || 'User'
  const detector = sessionDetectorFields(input.userAgent)
  const agentClient = String(detector.clientName ?? 'UNKNOWN')
  const agentDevice = String(detector.deviceBrand ?? 'UNKNOWN')
  const agentOs = String(detector.osName ?? 'UNKNOWN')

  await mail.build({
    to: input.email,
    templateFile: 'email-otp.tpl',
    templateKey: `otpSession-${locale.locale}`,
    subject: locale.format('emails.otpSession.subject', { project: projectName }),
    data: {
      hello: locale.format('emails.otpSession.hello', { user: userName }),
      description: locale.format('emails.otpSession.description', {
        project: projectName,
      }),
      clientInfo: locale.format('emails.otpSession.clientInfo', {
        agentClient,
        agentDevice,
        agentOs,
      }),
      thanks: locale.format('emails.otpSession.thanks'),
      signature: locale.format('emails.otpSession.signature', {
        project: projectName,
      }),
      securityPhrase: '',
    },
    variables: {
      direction: locale.format('settings.direction'),
      user: userName,
      project: projectName,
      otp: input.secret,
    },
  })
}
