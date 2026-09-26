import { hashPassword } from '@nuvix/core/auth'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../shared/errors'
import type {
  MembershipsDoc,
  Targets,
  TargetsDoc,
  Tokens,
  TokensDoc,
  Users,
  UsersDoc,
} from '../types/generated'
import { signJwt } from '../utils/jwt'
import {
  formatMembership,
  formatToken,
  formatUser,
  type MembershipView,
  type TokenView,
  type UserView,
} from './formatter'

export interface CreateUserInput {
  userId?: string
  email?: string
  phone?: string
  password?: string
  name?: string
}

export class UsersService {
  constructor(
    private readonly session: Session,
    private readonly jwtSecret?: string,
  ) {}

  async findAll(
    queries: Query[] = [],
    search?: string,
  ): Promise<{ total: number; users: UserView[] }> {
    const q = [...queries]
    if (search) {
      q.push(Query.search('search', search))
    }
    const filterQueries = Query.groupByType(q).filters

    const docs = (await this.session.find('users', q)) as UsersDoc[]
    const total = await this.session.count('users', filterQueries)

    return {
      total,
      users: docs.map((doc) => formatUser(doc, doc.get('targets') || [])),
    }
  }

  async findOne(userId: string): Promise<UserView> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    const targets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
    ])) as TargetsDoc[]

    return formatUser(userDoc, targets)
  }

  async create(input: CreateUserInput): Promise<UserView> {
    return this.createUser(input, 'argon2id')
  }

  async createArgon2(input: CreateUserInput): Promise<UserView> {
    return this.createUser(input, 'argon2id')
  }

  async createBcrypt(input: CreateUserInput): Promise<UserView> {
    return this.createUser(input, 'bcrypt')
  }

  private async createUser(
    input: CreateUserInput,
    algorithm: 'argon2id' | 'bcrypt',
  ): Promise<UserView> {
    const userId =
      input.userId && input.userId !== 'unique()' ? ID.custom(input.userId) : ID.unique()

    const email = input.email ? input.email.toLowerCase() : undefined
    if (email) {
      const existingEmail = await this.session.findOne('users', [Query.equal('email', [email])])
      if (!existingEmail.empty()) {
        throw new ConflictError('User with this email already exists', {
          code: 'user_email_already_exists',
        })
      }
    }

    if (input.phone) {
      const existingPhone = await this.session.findOne('users', [
        Query.equal('phone', [input.phone]),
      ])
      if (!existingPhone.empty()) {
        throw new ConflictError('User with this phone already exists', {
          code: 'user_phone_already_exists',
        })
      }
    }

    let passwordHash: string | undefined
    let passwordUpdate: Date | undefined
    if (input.password) {
      passwordHash = await hashPassword(input.password, { algorithm })
      passwordUpdate = new Date()
    }

    const now = new Date()

    const userDoc = (await this.session.createDocument(
      'users',
      new Doc<Users>({
        $id: userId,
        $permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ],
        name: input.name ?? '',
        email: email ?? '',
        phone: input.phone ?? '',
        status: true,
        emailVerification: false,
        phoneVerification: false,
        mfa: false,
        labels: [],
        passwordHistory: passwordHash ? [passwordHash] : [],
        password: passwordHash,
        hash: algorithm,
        hashOptions: { algorithm },
        passwordUpdate,
        registration: now,
        accessedAt: now,
        prefs: {},
        search: [userId, email ?? '', input.phone ?? '', input.name ?? '']
          .filter(Boolean)
          .join(' '),
      }),
    )) as UsersDoc

    const targets: TargetsDoc[] = []
    if (email) {
      const emailTarget = (await this.session.createDocument(
        'targets',
        new Doc<Targets>({
          $id: ID.unique(),
          $permissions: [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
          ],
          userId,
          userInternalId: userDoc.getSequence(),
          providerType: 'email',
          identifier: email,
          name: input.name ?? '',
          expired: false,
        }),
      )) as TargetsDoc
      targets.push(emailTarget)
    }
    if (input.phone) {
      const phoneTarget = (await this.session.createDocument(
        'targets',
        new Doc<Targets>({
          $id: ID.unique(),
          $permissions: [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
          ],
          userId,
          userInternalId: userDoc.getSequence(),
          providerType: 'sms',
          identifier: input.phone,
          name: input.name ?? '',
          expired: false,
        }),
      )) as TargetsDoc
      targets.push(phoneTarget)
    }

    return formatUser(userDoc, targets)
  }

  async updateStatus(userId: string, status: boolean): Promise<UserView> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    userDoc.set('status', status)
    const updated = (await this.session.updateDocument('users', userId, userDoc)) as UsersDoc
    return formatUser(updated, userDoc.get('targets') || [])
  }

  async updateName(userId: string, name: string): Promise<UserView> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    userDoc.set('name', name)
    userDoc.set(
      'search',
      [userId, userDoc.get('email') ?? '', userDoc.get('phone') ?? '', name]
        .filter(Boolean)
        .join(' '),
    )
    const updated = (await this.session.updateDocument('users', userId, userDoc)) as UsersDoc
    return formatUser(updated, userDoc.get('targets') || [])
  }

  async updateEmail(userId: string, email: string): Promise<UserView> {
    const normalized = email.toLowerCase()
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const existing = await this.session.findOne('users', [Query.equal('email', [normalized])])
    if (!existing.empty() && existing.getId() !== userId) {
      throw new ConflictError('User with this email already exists', {
        code: 'user_email_already_exists',
      })
    }

    userDoc.set('email', normalized)
    userDoc.set('emailVerification', false)
    userDoc.set(
      'search',
      [userId, normalized, userDoc.get('phone') ?? '', userDoc.get('name') ?? '']
        .filter(Boolean)
        .join(' '),
    )

    const updated = (await this.session.updateDocument('users', userId, userDoc)) as UsersDoc

    // Sync or create email target
    const targets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
      Query.equal('providerType', ['email']),
    ])) as TargetsDoc[]

    if (targets.length > 0) {
      const target = targets[0]!
      target.set('identifier', normalized)
      await this.session.updateDocument('targets', target.getId(), target)
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
          userInternalId: userDoc.getSequence(),
          providerType: 'email',
          identifier: normalized,
          name: userDoc.get('name') ?? '',
          expired: false,
        }),
      )
    }

    return formatUser(updated)
  }

  async updatePhone(userId: string, phone: string): Promise<UserView> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const existing = await this.session.findOne('users', [Query.equal('phone', [phone])])
    if (!existing.empty() && existing.getId() !== userId) {
      throw new ConflictError('User with this phone already exists', {
        code: 'user_phone_already_exists',
      })
    }

    userDoc.set('phone', phone)
    userDoc.set('phoneVerification', false)
    userDoc.set(
      'search',
      [userId, userDoc.get('email') ?? '', phone, userDoc.get('name') ?? '']
        .filter(Boolean)
        .join(' '),
    )

    const updated = (await this.session.updateDocument('users', userId, userDoc)) as UsersDoc

    // Sync or create phone target
    const targets = (await this.session.find('targets', [
      Query.equal('userId', [userId]),
      Query.equal('providerType', ['sms']),
    ])) as TargetsDoc[]

    if (targets.length > 0) {
      const target = targets[0]!
      target.set('identifier', phone)
      await this.session.updateDocument('targets', target.getId(), target)
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
          userInternalId: userDoc.getSequence(),
          providerType: 'sms',
          identifier: phone,
          name: userDoc.get('name') ?? '',
          expired: false,
        }),
      )
    }

    return formatUser(updated)
  }

  async updatePassword(userId: string, password: string): Promise<UserView> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const hash = await hashPassword(password, { algorithm: 'argon2id' })
    userDoc.set('password', hash)
    userDoc.set('hash', 'argon2id')
    userDoc.set('passwordUpdate', new Date())

    const history = (userDoc.get('passwordHistory') as string[]) || []
    userDoc.set('passwordHistory', [...history, hash])

    const updated = (await this.session.updateDocument('users', userId, userDoc)) as UsersDoc
    return formatUser(updated)
  }

  async updateLabels(userId: string, labels: string[]): Promise<UserView> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    userDoc.set('labels', labels)
    const updated = (await this.session.updateDocument('users', userId, userDoc)) as UsersDoc
    return formatUser(updated)
  }

  async updateEmailVerification(userId: string, emailVerification: boolean): Promise<UserView> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    userDoc.set('emailVerification', emailVerification)
    const updated = (await this.session.updateDocument('users', userId, userDoc)) as UsersDoc
    return formatUser(updated)
  }

  async updatePhoneVerification(userId: string, phoneVerification: boolean): Promise<UserView> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    userDoc.set('phoneVerification', phoneVerification)
    const updated = (await this.session.updateDocument('users', userId, userDoc)) as UsersDoc
    return formatUser(updated)
  }

  async getPrefs(userId: string): Promise<Record<string, unknown>> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    return (userDoc.get('prefs') ?? {}) as Record<string, unknown>
  }

  async updatePrefs(
    userId: string,
    prefs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    userDoc.set('prefs', prefs)
    await this.session.updateDocument('users', userId, userDoc)
    return prefs
  }

  async delete(userId: string): Promise<{ status: 'success' }> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    await this.session.deleteDocument('users', userId)

    // Clean up sub-resources
    const targets = await this.session.find('targets', [Query.equal('userId', [userId])])
    for (const t of targets) {
      await this.session.deleteDocument('targets', t.getId())
    }

    const sessions = await this.session.find('sessions', [
      Query.equal('userInternalId', [userDoc.getSequence()]),
    ])
    for (const s of sessions) {
      await this.session.deleteDocument('sessions', s.getId())
    }

    const tokens = await this.session.find('tokens', [
      Query.equal('userInternalId', [userDoc.getSequence()]),
    ])
    for (const tok of tokens) {
      await this.session.deleteDocument('tokens', tok.getId())
    }

    return { status: 'success' }
  }

  async createJwt(
    userId: string,
    sessionId?: string,
    duration: number = 900,
  ): Promise<{ jwt: string }> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }
    if (!this.jwtSecret) {
      throw new Error('JWT secret not configured')
    }
    const token = await signJwt(
      {
        sub: userId,
        sid: sessionId,
      },
      this.jwtSecret,
      duration,
    )
    return { jwt: token }
  }

  async createToken(
    userId: string,
    type: number | string,
    expireInSeconds: number = 3600,
    phrase?: string,
  ): Promise<TokenView> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const tokenId = ID.unique()
    const expire = new Date(Date.now() + expireInSeconds * 1000)

    const tokenDoc = (await this.session.createDocument(
      'tokens',
      new Doc<Tokens>({
        $id: tokenId,
        $permissions: [Permission.read(Role.user(userId)), Permission.delete(Role.user(userId))],
        userId,
        userInternalId: userDoc.getSequence(),
        type,
        expire,
        phrase: phrase ?? '',
      }),
    )) as TokensDoc

    return formatToken(tokenDoc)
  }

  async getMemberships(
    userId: string,
    queries: Query[] = [],
  ): Promise<{ total: number; memberships: MembershipView[] }> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const q = [Query.equal('userId', [userId]), ...queries]
    const docs = (await this.session.find('memberships', q)) as MembershipsDoc[]
    const total = await this.session.count('memberships', Query.groupByType(q).filters)

    return {
      total,
      memberships: docs.map(formatMembership),
    }
  }

  async getUsage(range = '30d'): Promise<{
    range: string
    usersTotal: number
    sessionsTotal: number
    users: Array<{ date: string; value: number }>
    sessions: Array<{ date: string; value: number }>
  }> {
    const [usersTotal, sessionsTotal] = await Promise.all([
      this.session.count('users', []),
      this.session.count('sessions', []),
    ])

    const now = new Date().toISOString()
    return {
      range,
      usersTotal,
      sessionsTotal,
      users: [{ date: now, value: usersTotal }],
      sessions: [{ date: now, value: sessionsTotal }],
    }
  }
}
