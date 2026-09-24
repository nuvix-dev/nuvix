import {
  Auth,
  type HashAlgorithm,
  validatePasswordHistory,
  validatePersonalData,
} from '@nuvix/core/auth'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors'
import type { Targets, TargetsDoc, Tokens, TokensDoc, Users, UsersDoc } from '../../types/generated'
import { type AccountView, formatAccount, formatToken, type TokenView } from './formatter'

export interface CreateAccountInput {
  userId?: string
  email: string
  password: string
  name?: string
}

export class AccountService {
  constructor(private readonly session: Session) {}

  async createAccount(input: CreateAccountInput): Promise<AccountView> {
    const email = input.email.toLowerCase()

    const existingIdentity = await this.session.findOne('identities', [
      Query.equal('providerEmail', [email]),
    ])
    if (!existingIdentity.empty()) {
      throw new BadRequestError('Invalid credentials', {
        code: 'general_bad_request',
      })
    }

    const existingUser = await this.session.findOne('users', [Query.equal('email', [email])])
    if (!existingUser.empty()) {
      throw new ConflictError('User already exists', {
        code: 'user_already_exists',
      })
    }

    const validPersonal = validatePersonalData(input.password, {
      userId: input.userId,
      email,
      name: input.name,
    })
    if (!validPersonal) {
      throw new BadRequestError('Password must not include personal data', {
        code: 'user_password_personal_data',
      })
    }

    const hashedPassword = await Auth.passwordHash(input.password, Auth.DEFAULT_ALGO)
    const userId =
      input.userId && input.userId !== 'unique()' ? ID.custom(input.userId) : ID.unique()

    const userDoc = new Doc<Users>({
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
      password: hashedPassword,
      passwordHistory: [hashedPassword],
      passwordUpdate: new Date(),
      hash: Auth.DEFAULT_ALGO,
      hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
      registration: new Date(),
      reset: false,
      name: input.name ?? '',
      mfa: false,
      prefs: {},
      search: [userId, email, input.name ?? ''].filter(Boolean).join(' '),
      accessedAt: new Date(),
    })

    const createdUser = (await this.session.createDocument('users', userDoc)) as UsersDoc

    const targetDoc = new Doc<Targets>({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ],
      userId,
      userInternalId: createdUser.getSequence(),
      providerType: 'email',
      identifier: email,
      name: input.name ?? '',
      expired: false,
    })

    const createdTarget = (await this.session.createDocument('targets', targetDoc)) as TargetsDoc

    return formatAccount(createdUser, [createdTarget])
  }

  async getAccount(userId: string): Promise<AccountView> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    const targets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
    ])) as TargetsDoc[]
    return formatAccount(user, targets)
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    if (user.get('status') === false) {
      throw new ForbiddenError('User is blocked', { code: 'user_blocked' })
    }
    await this.session.deleteDocument('users', userId)
  }

  async getPrefs(userId: string): Promise<Record<string, unknown>> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    return (user.get('prefs') ?? {}) as Record<string, unknown>
  }

  async updatePrefs(
    userId: string,
    prefs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    user.set('prefs', prefs)
    await this.session.updateDocument('users', userId, user)
    return prefs
  }

  async updateName(userId: string, name: string): Promise<AccountView> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    user.set('name', name)
    user.set(
      'search',
      [userId, user.get('email') ?? '', user.get('phone') ?? '', name].filter(Boolean).join(' '),
    )
    const updated = (await this.session.updateDocument('users', userId, user)) as UsersDoc
    const targets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
    ])) as TargetsDoc[]
    return formatAccount(updated, targets)
  }

  async updatePassword(
    userId: string,
    password: string,
    oldPassword?: string,
  ): Promise<AccountView> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    const passwordUpdate = user.get('passwordUpdate')
    if (passwordUpdate) {
      if (!oldPassword) {
        throw new UnauthorizedError('Invalid credentials', {
          code: 'user_invalid_credentials',
        })
      }
      const valid = await Auth.passwordVerify(
        oldPassword,
        user.get('password') ?? '',
        (user.get('hash') as HashAlgorithm) ?? Auth.DEFAULT_ALGO,
      )
      if (!valid) {
        throw new UnauthorizedError('Invalid credentials', {
          code: 'user_invalid_credentials',
        })
      }
    }

    const validPersonal = validatePersonalData(password, {
      userId,
      email: user.get('email'),
      name: user.get('name'),
      phone: user.get('phone'),
    })
    if (!validPersonal) {
      throw new BadRequestError('Password must not include personal data', {
        code: 'user_password_personal_data',
      })
    }

    const history = (user.get('passwordHistory') ?? []) as string[]
    const validHistory = await validatePasswordHistory(
      password,
      history,
      (user.get('hash') as HashAlgorithm) ?? Auth.DEFAULT_ALGO,
    )
    if (!validHistory) {
      throw new BadRequestError('Password was recently used', {
        code: 'user_password_recently_used',
      })
    }

    const hashedPassword = await Auth.passwordHash(password, Auth.DEFAULT_ALGO)
    history.push(hashedPassword)
    if (history.length > 10) {
      history.splice(0, history.length - 10)
    }

    user.set('password', hashedPassword)
    user.set('passwordHistory', history)
    user.set('passwordUpdate', new Date())
    user.set('hash', Auth.DEFAULT_ALGO)
    user.set('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)

    const updated = (await this.session.updateDocument('users', userId, user)) as UsersDoc
    const targets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
    ])) as TargetsDoc[]
    return formatAccount(updated, targets)
  }

  async updateEmail(userId: string, email: string, password?: string): Promise<AccountView> {
    const normalized = email.toLowerCase()
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    const passwordUpdate = user.get('passwordUpdate')
    if (passwordUpdate) {
      if (!password) {
        throw new UnauthorizedError('Invalid credentials', {
          code: 'user_invalid_credentials',
        })
      }
      const valid = await Auth.passwordVerify(
        password,
        user.get('password') ?? '',
        (user.get('hash') as HashAlgorithm) ?? Auth.DEFAULT_ALGO,
      )
      if (!valid) {
        throw new UnauthorizedError('Invalid credentials', {
          code: 'user_invalid_credentials',
        })
      }
    }

    const existing = await this.session.findOne('users', [Query.equal('email', [normalized])])
    if (!existing.empty() && existing.getId() !== userId) {
      throw new ConflictError('User with this email already exists', {
        code: 'user_email_already_exists',
      })
    }

    const existingIdentity = await this.session.findOne('identities', [
      Query.equal('providerEmail', [normalized]),
    ])
    if (!existingIdentity.empty() && existingIdentity.get('userId') !== userId) {
      throw new BadRequestError('Invalid credentials', {
        code: 'general_bad_request',
      })
    }

    user.set('email', normalized)
    user.set('emailVerification', false)
    user.set(
      'search',
      [userId, normalized, user.get('phone') ?? '', user.get('name') ?? '']
        .filter(Boolean)
        .join(' '),
    )

    const updated = (await this.session.updateDocument('users', userId, user)) as UsersDoc

    const targets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
      Query.equal('providerType', ['email']),
    ])) as TargetsDoc[]

    if (targets.length > 0 && targets[0]) {
      const t = targets[0]
      t.set('identifier', normalized)
      await this.session.updateDocument('targets', t.getId(), t)
    } else {
      await this.session.createDocument(
        'targets',
        new Doc<Targets>({
          $id: ID.unique(),
          $permissions: [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
          ],
          userId,
          userInternalId: user.getSequence(),
          providerType: 'email',
          identifier: normalized,
          name: user.get('name') ?? '',
          expired: false,
        }),
      )
    }

    const allTargets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
    ])) as TargetsDoc[]
    return formatAccount(updated, allTargets)
  }

  async updatePhone(userId: string, phone: string, password?: string): Promise<AccountView> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    const passwordUpdate = user.get('passwordUpdate')
    if (passwordUpdate) {
      if (!password) {
        throw new UnauthorizedError('Invalid credentials', {
          code: 'user_invalid_credentials',
        })
      }
      const valid = await Auth.passwordVerify(
        password,
        user.get('password') ?? '',
        (user.get('hash') as HashAlgorithm) ?? Auth.DEFAULT_ALGO,
      )
      if (!valid) {
        throw new UnauthorizedError('Invalid credentials', {
          code: 'user_invalid_credentials',
        })
      }
    }

    const existing = await this.session.findOne('users', [Query.equal('phone', [phone])])
    if (!existing.empty() && existing.getId() !== userId) {
      throw new ConflictError('User with this phone already exists', {
        code: 'user_phone_already_exists',
      })
    }

    user.set('phone', phone)
    user.set('phoneVerification', false)
    user.set(
      'search',
      [userId, user.get('email') ?? '', phone, user.get('name') ?? ''].filter(Boolean).join(' '),
    )

    const updated = (await this.session.updateDocument('users', userId, user)) as UsersDoc

    const targets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
      Query.equal('providerType', ['sms']),
    ])) as TargetsDoc[]

    if (targets.length > 0 && targets[0]) {
      const t = targets[0]
      t.set('identifier', phone)
      await this.session.updateDocument('targets', t.getId(), t)
    } else {
      await this.session.createDocument(
        'targets',
        new Doc<Targets>({
          $id: ID.unique(),
          $permissions: [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
          ],
          userId,
          userInternalId: user.getSequence(),
          providerType: 'sms',
          identifier: phone,
          name: user.get('name') ?? '',
          expired: false,
        }),
      )
    }

    const allTargets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
    ])) as TargetsDoc[]
    return formatAccount(updated, allTargets)
  }

  async updateStatus(userId: string): Promise<AccountView> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    user.set('status', false)
    const updated = (await this.session.updateDocument('users', userId, user)) as UsersDoc
    const targets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
    ])) as TargetsDoc[]
    return formatAccount(updated, targets)
  }

  async createEmailVerification(
    userId: string,
    _url?: string,
    userAgent = 'UNKNOWN',
    ip = '127.0.0.1',
  ): Promise<TokenView> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    if (user.get('emailVerification')) {
      throw new BadRequestError('Email already verified', {
        code: 'user_email_already_verified',
      })
    }
    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_VERIFICATION)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_CONFIRM * 1000)

    const tokenDoc = (await this.session.createDocument(
      'tokens',
      new Doc<Tokens>({
        $id: ID.unique(),
        $permissions: [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ],
        userId,
        userInternalId: user.getSequence(),
        type: 1, // Verification
        secret: Auth.hash(secret),
        expire,
        userAgent,
        ip,
      }),
    )) as TokensDoc

    const formatted = formatToken(tokenDoc)
    formatted.secret = secret
    return formatted
  }

  async updateEmailVerification(userId: string, secret: string): Promise<TokenView> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    const tokens = (await this.session.find('tokens', [
      Query.equal('userId', [userId]),
      Query.equal('type', [1]),
    ])) as TokensDoc[]

    const verified = Auth.tokenVerify(tokens, 1, secret)
    if (!verified) {
      throw new BadRequestError('Invalid token', { code: 'user_invalid_token' })
    }

    user.set('emailVerification', true)
    await this.session.updateDocument('users', userId, user)
    await this.session.deleteDocument('tokens', verified.getId())

    const formatted = formatToken(verified as TokensDoc)
    formatted.secret = secret
    return formatted
  }

  async createPhoneVerification(
    userId: string,
    userAgent = 'UNKNOWN',
    ip = '127.0.0.1',
  ): Promise<TokenView> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    if (!user.get('phone')) {
      throw new BadRequestError('Phone number is missing', {
        code: 'user_phone_not_found',
      })
    }
    if (user.get('phoneVerification')) {
      throw new BadRequestError('Phone already verified', {
        code: 'user_phone_already_verified',
      })
    }
    const secret = Auth.codeGenerator(6)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_OTP * 1000)

    const tokenDoc = (await this.session.createDocument(
      'tokens',
      new Doc<Tokens>({
        $id: ID.unique(),
        $permissions: [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ],
        userId,
        userInternalId: user.getSequence(),
        type: 2, // Phone
        secret: Auth.hash(secret),
        expire,
        userAgent,
        ip,
      }),
    )) as TokensDoc

    const formatted = formatToken(tokenDoc)
    formatted.secret = secret
    return formatted
  }

  async updatePhoneVerification(userId: string, secret: string): Promise<TokenView> {
    const user = (await this.session.getDocument('users', userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    const tokens = (await this.session.find('tokens', [
      Query.equal('userId', [userId]),
      Query.equal('type', [2]),
    ])) as TokensDoc[]

    const verified = Auth.tokenVerify(tokens, 2, secret)
    if (!verified) {
      throw new BadRequestError('Invalid token', { code: 'user_invalid_token' })
    }

    user.set('phoneVerification', true)
    await this.session.updateDocument('users', userId, user)
    await this.session.deleteDocument('tokens', verified.getId())

    const formatted = formatToken(verified as TokensDoc)
    formatted.secret = secret
    return formatted
  }
}
