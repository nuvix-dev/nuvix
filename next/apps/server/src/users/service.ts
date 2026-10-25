import { AuditService } from '@nuvix/core/audit'
import { hashPassword } from '@nuvix/core/auth'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import { MetricFor } from '@nuvix/utils'
import { formatIdentity, type IdentityView } from '../account/formatter'
import { ConflictError, NotFoundError } from '../shared/errors'
import { parseUsageRange, readUsageSeries } from '../stats/usage'
import type {
  IdentitiesDoc,
  MembershipsDoc,
  Targets,
  TargetsDoc,
  Tokens,
  TokensDoc,
  Users,
  UsersDoc,
} from '../types/generated'
import { Detector } from '../utils/detector'
import { signJwt } from '../utils/jwt'
import {
  formatMembership,
  formatToken,
  formatUser,
  type MembershipView,
  type TokenView,
  type UserView,
} from './formatter'
import type { LogView } from './logs-view'

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

  /**
   * List all identities in the project (admin) — v1 parity.
   */
  async getIdentities(
    queries: Query[] = [],
    search?: string,
  ): Promise<{ total: number; identities: IdentityView[] }> {
    const q = [...queries]
    if (search) {
      q.push(Query.search('search', search))
    }
    const filterQueries = Query.groupByType(q).filters

    const docs = (await this.session.find('identities', q)) as IdentitiesDoc[]
    const total = await this.session.count('identities', filterQueries)

    return {
      total,
      identities: docs.map(formatIdentity),
    }
  }

  /**
   * Delete an identity (admin) — v1 parity.
   */
  async deleteIdentity(identityId: string): Promise<void> {
    const identity = (await this.session.getDocument('identities', identityId)) as IdentitiesDoc
    if (identity.empty()) {
      throw new NotFoundError('Identity not found', {
        code: 'user_identity_not_found',
      })
    }
    await this.session.deleteDocument('identities', identityId)
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

  /**
   * Activity logs for a user (admin) — v1 parity: reads the `audit`
   * collection by the user's internal sequence and decorates each log with
   * detected UA fields + geoip country + localized country name.
   */
  async getLogs(
    userId: string,
    locale: { raw(key: string): string | null; format(key: string): string },
    queries: Query[] = [],
    geoip?: { lookup(ip: string): { countryCode?: string } | null },
  ): Promise<{ total: number; logs: LogView[] }> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const audit = new AuditService(this.session)
    const logs = await audit.getLogsByUser(userDoc.getSequence(), queries)
    const total = await audit.countLogsByUser(userDoc.getSequence())

    const output: LogView[] = logs.map((log) => {
      const data = (log.get('data') ?? {}) as Record<string, unknown>
      const userAgent = String(log.get('userAgent') ?? 'UNKNOWN')
      const detector = new Detector(userAgent)
      const os = detector.getOS()
      const client = detector.getClient()
      const device = detector.getDevice()

      const ip = String(log.get('ip') ?? '')
      const countryCode = geoip?.lookup(ip)?.countryCode
      const key = `countries.${(countryCode ?? '').toLowerCase()}`
      const countryName =
        countryCode && locale.raw(key) !== null
          ? locale.format(key)
          : locale.raw('locale.country.unknown') !== null
            ? locale.format('locale.country.unknown')
            : 'Unknown'

      return {
        event: String(log.get('event') ?? ''),
        userId: String(data.userId ?? ''),
        userEmail: data.userEmail ? String(data.userEmail) : null,
        userName: data.userName ? String(data.userName) : null,
        ip,
        time: log.get('time') ? String(log.get('time')) : '',
        osCode: os.osCode,
        osName: os.osName,
        osVersion: os.osVersion,
        clientType: client.clientType,
        clientCode: client.clientCode,
        clientName: client.clientName,
        clientVersion: client.clientVersion,
        clientEngine: client.clientEngine,
        clientEngineVersion: client.clientEngineVersion,
        deviceName: device.deviceName,
        deviceBrand: device.deviceBrand,
        deviceModel: device.deviceModel,
        countryCode,
        countryName,
      }
    })

    return { total, logs: output }
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
    // v1 parity: usage reads the recorded `stats` rows (INF totals + the
    // period-bucketed series), not live counts.
    const usageRange = parseUsageRange(range)
    const usage = await readUsageSeries(
      this.session,
      [MetricFor.USERS, MetricFor.SESSIONS],
      usageRange,
    )

    return {
      range: usageRange,
      usersTotal: usage[MetricFor.USERS]?.total ?? 0,
      sessionsTotal: usage[MetricFor.SESSIONS]?.total ?? 0,
      users: usage[MetricFor.USERS]?.data ?? [],
      sessions: usage[MetricFor.SESSIONS]?.data ?? [],
    }
  }
}
