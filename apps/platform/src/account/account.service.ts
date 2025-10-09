import { Injectable, UseInterceptors } from '@nestjs/common'
import {
  Authorization,
  Database,
  Doc,
  DuplicateException,
  ID,
  Permission,
  Query,
  Role,
} from '@nuvix/db'

import { CountryResponse, Reader } from 'maxmind'
import { Exception } from '@nuvix/core/extend/exception'
import { Auth } from '@nuvix/core/helper/auth.helper'
import { Detector } from '@nuvix/core/helper/detector.helper'
import { PersonalDataValidator } from '@nuvix/core/validators/personal-data.validator'
import {
  QueueFor,
  AppEvents,
  type HashAlgorithm,
  SessionProvider,
  TokenType,
  AuthFactor,
} from '@nuvix/utils'
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor'
import {
  UpdateEmailDTO,
  UpdatePasswordDTO,
  UpdatePhoneDTO,
} from './DTO/account.dto'
import { PasswordHistoryValidator } from '@nuvix/core/validators/password-history.validator'
import { CreateEmailSessionDTO, CreateSessionDTO } from './DTO/session.dto'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import * as Template from 'handlebars'
import * as fs from 'fs/promises'
import {
  MailJob,
  MailQueueOptions,
} from '@nuvix/core/resolvers/queues/mails.queue'
import path from 'path'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { JwtService } from '@nestjs/jwt'
import { LocaleTranslator } from '@nuvix/core/helper'
import { CreateEmailTokenDTO } from './DTO/token.dto'
import { PhraseGenerator } from '@nuvix/utils/auth/pharse'
import { Audit } from '@nuvix/audit'
import type {
  MembershipsDoc,
  Sessions,
  SessionsDoc,
  TargetsDoc,
  Tokens,
  TokensDoc,
  UsersDoc,
} from '@nuvix/utils/types'
import { AppConfigService, CoreService, Platform } from '@nuvix/core'
import { Hooks } from '@nuvix/core/extend/hooks'

@Injectable()
@UseInterceptors(ResponseInterceptor)
export class AccountService {
  private readonly geodb: Reader<CountryResponse>
  private readonly db: Database
  private readonly platform: Doc<Platform>
  constructor(
    private readonly coreService: CoreService,
    private readonly appConfig: AppConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly jwtService: JwtService,
    @InjectQueue(QueueFor.MAILS)
    private readonly mailsQueue: Queue<MailQueueOptions, MailJob>,
  ) {
    this.db = this.coreService.getPlatformDb()
    this.geodb = coreService.getGeoDb()
    this.platform = coreService.getPlatform()
  }

  /**
   * Create a new account
   */
  async createAccount(
    userId: string,
    email: string,
    password: string,
    name: string | undefined,
    user: UsersDoc,
    ip: string,
  ): Promise<UsersDoc> {
    email = email.toLowerCase()

    const whitelistEmails = this.platform.get('authWhitelistEmails')
    const whitelistIPs = this.platform.get('authWhitelistIPs', false)

    if (
      whitelistEmails &&
      !whitelistEmails.includes(email) &&
      !whitelistEmails.includes(email.toUpperCase())
    ) {
      throw new Exception(Exception.USER_EMAIL_NOT_WHITELISTED)
    }

    if (whitelistIPs && !whitelistIPs.includes(ip)) {
      throw new Exception(Exception.USER_IP_NOT_WHITELISTED)
    }

    const limit = this.platform.get('auths').limit ?? 0
    if (limit !== 0) {
      const total = await this.db.count('users', [])

      if (total >= limit) {
        throw new Exception(Exception.USER_CONSOLE_COUNT_EXCEEDED)
      }
    }

    const identityWithMatchingEmail = await this.db.findOne('identities', [
      Query.equal('providerEmail', [email]),
    ])

    if (identityWithMatchingEmail && !identityWithMatchingEmail.empty()) {
      throw new Exception(Exception.GENERAL_BAD_REQUEST)
    }

    if (this.platform.get('auths').personalDataCheck ?? false) {
      const personalDataValidator = new PersonalDataValidator(
        userId,
        email,
        name,
        null,
      )
      if (!personalDataValidator.$valid(password)) {
        throw new Exception(Exception.USER_PASSWORD_PERSONAL_DATA)
      }
    }

    await Hooks.trigger('passwordValidator', [
      this.db,
      new Doc(),
      password,
      user,
      true,
    ])

    const passwordHistory = this.platform.get('auths').passwordHistory ?? 0
    const hashedPassword =
      (await Auth.passwordHash(
        password,
        Auth.DEFAULT_ALGO,
        Auth.DEFAULT_ALGO_OPTIONS,
      )) ?? undefined

    try {
      userId = userId === 'unique()' ? ID.unique() : userId
      user.setAll({
        $id: userId,
        $permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ],
        email: email,
        emailVerification: false,
        status: true,
        password: hashedPassword,
        passwordHistory:
          passwordHistory > 0 && hashedPassword ? [hashedPassword] : [],
        passwordUpdate: new Date(),
        hash: Auth.DEFAULT_ALGO,
        hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
        registration: new Date(),
        reset: false,
        name: name,
        mfa: false,
        prefs: {},
        search: `${userId} ${email} ${name}`,
        accessedAt: new Date(),
      })
      user.delete('$sequence')
      user = await Authorization.skip(() =>
        this.db.createDocument('users', user),
      )

      try {
        const target = await Authorization.skip(() =>
          this.db.createDocument(
            'targets',
            new Doc({
              $permissions: [
                Permission.read(Role.user(user.getId())),
                Permission.update(Role.user(user.getId())),
                Permission.delete(Role.user(user.getId())),
              ],
              userId: user.getId(),
              userInternalId: user.getSequence(),
              providerType: 'email',
              identifier: email,
            }) as TargetsDoc,
          ),
        )
        user.set('targets', [...user.get('targets', []), target])
      } catch (error) {
        if (error instanceof DuplicateException) {
          const existingTarget = await this.db.findOne('targets', [
            Query.equal('identifier', [email]),
          ])
          if (existingTarget) {
            user.append('targets', existingTarget)
          }
        } else {
          throw error
        }
      }

      await this.db.purgeCachedDocument('users', user.getId())
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_ALREADY_EXISTS)
      } else {
        console.error(error)
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Failed saving user to DB',
        )
      }
    }

    Authorization.unsetRole(Role.guests().toString())
    Authorization.setRole(Role.user(user.getId()).toString())
    Authorization.setRole(Role.users().toString())

    const templatePath = path.join(
      this.appConfig.assetConfig.templates,
      'email-account-create.tpl',
    )
    const templateSource = await fs.readFile(templatePath, 'utf8')
    const template = Template.compile(templateSource)

    const body = template({
      name: user.get('name', 'User'),
      verification_link: '#',
    })

    const vars = {
      date: new Date().toDateString(),
      year: new Date().getFullYear(),
    }

    await this.mailsQueue.add(MailJob.SEND_EMAIL, {
      subject: 'Account Created! Start Exploring Nuvix Now ⚡',
      email: user.get('email'),
      body: body,
      variables: vars,
    })

    // queueForAppEvents.setParam('userId', user.getId());

    return user
  }

  /**
   * Update user's prefs
   */
  async updatePrefs(user: UsersDoc, prefs: Record<string, any>) {
    user.set('prefs', prefs)
    user = await this.db.updateDocument('users', user.getId(), user)

    return user.get('prefs', {})
  }

  /**
   * Delete User Account.
   */
  async deleteAccount(user: UsersDoc) {
    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    // Get all memberships and check if user can be deleted
    const memberships = user.get('memberships', []) as MembershipsDoc[]
    for (const membership of memberships) {
      if (membership.get('confirm', false)) {
        throw new Exception(Exception.USER_DELETION_PROHIBITED)
      }
    }

    await Authorization.skip(() =>
      this.db.deleteDocument('users', user.getId()),
    )
    await this.db.purgeCachedDocument('users', user.getId())

    return user
  }

  /**
   * Update User's Email
   */
  async updateEmail(user: UsersDoc, input: UpdateEmailDTO) {
    const passwordUpdate = user.get('passwordUpdate')

    if (
      passwordUpdate &&
      !(await Auth.passwordVerify(
        input.password,
        user.get('password'),
        user.get('hash') as HashAlgorithm,
        user.get('hashOptions'),
      ))
    ) {
      throw new Exception(Exception.USER_INVALID_CREDENTIALS)
    }

    const oldEmail = user.get('email')
    const email = input.email.toLowerCase()

    const identityWithMatchingEmail = await this.db.findOne('identities', qb =>
      qb
        .equal('providerEmail', email)
        .equal('userInternalId', user.getSequence()),
    )

    if (identityWithMatchingEmail && !identityWithMatchingEmail.empty()) {
      throw new Exception(Exception.GENERAL_BAD_REQUEST)
    }

    user.set('email', email).set('emailVerification', false)

    if (!passwordUpdate) {
      const hashedPassword = await Auth.passwordHash(
        input.password,
        Auth.DEFAULT_ALGO,
        Auth.DEFAULT_ALGO_OPTIONS,
      )
      user
        .set('password', hashedPassword)
        .set('hash', Auth.DEFAULT_ALGO)
        .set('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)
        .set('passwordUpdate', new Date())
    }

    const target = await Authorization.skip(() =>
      this.db.findOne('targets', [Query.equal('identifier', [email])]),
    )

    if (target && !target.empty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS)
    }

    try {
      user = await this.db.updateDocument('users', user.getId(), user)
      const oldTarget = user.findWhere(
        'targets',
        (target: TargetsDoc) => target.get('identifier') === oldEmail,
      )

      if (oldTarget && !oldTarget.empty()) {
        await Authorization.skip(() =>
          this.db.updateDocument(
            'targets',
            oldTarget.getId(),
            oldTarget.set('identifier', email),
          ),
        )
      }
      await this.db.purgeCachedDocument('users', user.getId())
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.GENERAL_BAD_REQUEST)
      } else {
        throw error
      }
    }
  }

  /**
   * Update User's Name
   */
  async updateName(user: UsersDoc, name: string) {
    user.set('name', name)
    user = await this.db.updateDocument('users', user.getId(), user)

    return user
  }

  /**
   * Update User's Password
   */
  async updatePassword(
    user: UsersDoc,
    { oldPassword, password: newPassword }: UpdatePasswordDTO,
  ) {
    // Check old password only if it's an existing user.
    if (
      user.get('passwordUpdate') &&
      !(await Auth.passwordVerify(
        oldPassword,
        user.get('password'),
        user.get('hash') as HashAlgorithm,
        user.get('hashOptions'),
      ))
    ) {
      throw new Exception(Exception.USER_INVALID_CREDENTIALS)
    }

    const hashedNewPassword = await Auth.passwordHash(
      newPassword,
      Auth.DEFAULT_ALGO,
      Auth.DEFAULT_ALGO_OPTIONS,
    )

    const historyLimit = this.platform.get('auths').passwordHistory ?? 0
    let history = user.get('passwordHistory', [])
    if (historyLimit > 0 && hashedNewPassword) {
      const validator = new PasswordHistoryValidator(
        history,
        user.get('hash'),
        user.get('hashOptions'),
      )
      if (!(await validator.$valid(newPassword))) {
        throw new Exception(Exception.USER_PASSWORD_RECENTLY_USED)
      }

      history.push(hashedNewPassword)
      history = history.slice(-historyLimit)
    }

    if (this.platform.get('auths').personalDataCheck ?? false) {
      const personalDataValidator = new PersonalDataValidator(
        user.getId(),
        user.get('email'),
        user.get('name'),
        user.get('phone'),
      )
      if (!personalDataValidator.$valid(newPassword)) {
        throw new Exception(Exception.USER_PASSWORD_PERSONAL_DATA)
      }
    }

    user
      .set('password', hashedNewPassword)
      .set('passwordHistory', history)
      .set('passwordUpdate', new Date())
      .set('hash', Auth.DEFAULT_ALGO)
      .set('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)

    // TODO: should update with request timestamp
    user = await this.db.updateDocument('users', user.getId(), user)

    return user
  }

  /**
   * Update User's Phone
   */
  async updatePhone(user: UsersDoc, { phone, password }: UpdatePhoneDTO) {
    const passwordUpdate = user.get('passwordUpdate')

    if (
      passwordUpdate &&
      !(await Auth.passwordVerify(
        password,
        user.get('password'),
        user.get('hash') as HashAlgorithm,
        user.get('hashOptions'),
      ))
    ) {
      throw new Exception(Exception.USER_INVALID_CREDENTIALS)
    }

    const oldPhone = user.get('phone')
    const target = await Authorization.skip(() =>
      this.db.findOne('targets', [Query.equal('identifier', [phone])]),
    )

    if (target && !target.empty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS)
    }

    user.set('phone', phone).set('phoneVerification', false)

    if (!passwordUpdate) {
      const hashedPassword = await Auth.passwordHash(
        password,
        Auth.DEFAULT_ALGO,
        Auth.DEFAULT_ALGO_OPTIONS,
      )
      user
        .set('password', hashedPassword)
        .set('hash', Auth.DEFAULT_ALGO)
        .set('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)
        .set('passwordUpdate', new Date())
    }

    try {
      user = await this.db.updateDocument('users', user.getId(), user)
      const oldTarget = user.findWhere(
        'targets',
        (target: TargetsDoc) => target.get('identifier') === oldPhone,
      )

      if (oldTarget && !oldTarget.empty()) {
        await Authorization.skip(() =>
          this.db.updateDocument(
            'targets',
            oldTarget.getId(),
            oldTarget.set('identifier', phone),
          ),
        )
      }
      await this.db.purgeCachedDocument('users', user.getId())
      return user
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_PHONE_ALREADY_EXISTS)
      } else {
        throw error
      }
    }
  }

  /**
   * Get User's Sessions
   */
  async getSessions(user: UsersDoc, locale: LocaleTranslator) {
    const sessions = user.get('sessions', [])
    const current = Auth.sessionVerify(sessions, Auth.secret)

    const updatedSessions = sessions.map((session: SessionsDoc) => {
      const countryName = locale.getText(
        'countries' + session.get('countryCode', '')?.toLowerCase(),
        locale.getText('locale.country.unknown'),
      )

      session.set('countryName', countryName)
      session.set('current', current === session.getId())

      return session
    })

    return {
      data: updatedSessions,
      total: updatedSessions.length,
    }
  }

  /**
   * Delete user's session
   */
  async deleteSessions(
    user: UsersDoc,
    locale: LocaleTranslator,
    request: NuvixRequest,
    response: NuvixRes,
  ) {
    const protocol = request.protocol
    const sessions = user.get('sessions', []) as SessionsDoc[]

    for (const session of sessions) {
      await this.db.deleteDocument('sessions', session.getId())
      session.set('current', false)
      session.set(
        'countryName',
        locale.getText(
          'countries' + session.get('countryCode', '')?.toLowerCase(),
          locale.getText('locale.country.unknown'),
        ),
      )

      if (session.get('secret') === Auth.hash(Auth.secret)) {
        session.set('current', true)

        // If current session, delete the cookies too
        response.cookie(Auth.cookieName, '', {
          expires: new Date(0),
          path: '/',
          domain: Auth.cookieDomain,
          secure: protocol === 'https',
          httpOnly: true,
          sameSite: Auth.cookieSamesite,
        })

        // queueForDeletes.setType(DELETE_TYPE_SESSION_TARGETS).setDocument(session).trigger();
      }
    }

    await this.db.purgeCachedDocument('users', user.getId())
    this.eventEmitter.emit(AppEvents.SESSION_DELETE, {
      userId: user.getId(),
    })
  }

  /**
   * Get a Session
   */
  async getSession(
    user: UsersDoc,
    sessionId: string,
    locale: LocaleTranslator,
  ) {
    const sessions = user.get('sessions', []) as SessionsDoc[]
    sessionId =
      sessionId === 'current'
        ? (Auth.sessionVerify(user.get('sessions'), Auth.secret) as string)
        : sessionId

    for (const session of sessions) {
      if (sessionId === session.getId()) {
        const countryName = locale.getText(
          'countries' + session.get('countryCode', '')?.toLowerCase(),
          locale.getText('locale.country.unknown'),
        )

        session
          .set('current', session.get('secret') === Auth.hash(Auth.secret))
          .set('countryName', countryName)

        return session
      }
    }

    throw new Exception(Exception.USER_SESSION_NOT_FOUND)
  }

  /**
   * Delete a Session
   */
  async deleteSession(
    user: UsersDoc,
    sessionId: string,
    request: NuvixRequest,
    response: NuvixRes,
  ) {
    const protocol = request.protocol
    const sessions = user.get('sessions', []) as SessionsDoc[]

    for (const session of sessions) {
      if (sessionId !== session.getId()) {
        continue
      }

      await this.db.deleteDocument('sessions', session.getId())

      session.set('current', false)
      if (session.get('secret') === Auth.hash(Auth.secret)) {
        session.set('current', true)

        response.cookie(Auth.cookieName, '', {
          expires: new Date(0),
          path: '/',
          domain: Auth.cookieDomain,
          secure: protocol === 'https',
          httpOnly: true,
          sameSite: Auth.cookieSamesite,
        })
      }

      await this.db.purgeCachedDocument('users', user.getId())
      return
    }

    throw new Exception(Exception.USER_SESSION_NOT_FOUND)
  }

  /**
   * Update a Session
   */
  async updateSession(user: UsersDoc, sessionId: string) {
    sessionId =
      sessionId === 'current'
        ? (Auth.sessionVerify(user.get('sessions'), Auth.secret) as string)
        : sessionId

    const sessions = user.get('sessions', []) as SessionsDoc[]
    let session: SessionsDoc | null = null

    for (const value of sessions) {
      if (sessionId === value.getId()) {
        session = value
        break
      }
    }

    if (session === null) {
      throw new Exception(Exception.USER_SESSION_NOT_FOUND)
    }

    const auths = this.platform.get('auths')
    const authDuration = auths.duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG
    session.set('expire', new Date(Date.now() + authDuration * 1000))

    await this.db.updateDocument('sessions', sessionId, session)
    await this.db.purgeCachedDocument('users', user.getId())

    return session
  }

  /**
   * Create a new session for the user using Email & Password
   */
  async createEmailSession(
    user: UsersDoc,
    input: CreateEmailSessionDTO,
    locale: LocaleTranslator,
    request: NuvixRequest,
    response: NuvixRes,
  ) {
    const email = input.email.toLowerCase()
    const protocol = request.protocol

    const profile = await this.db.findOne('users', qb =>
      qb.equal('email', email),
    )

    if (
      profile.empty() ||
      !profile.get('passwordUpdate') ||
      !(await Auth.passwordVerify(
        input.password,
        profile.get('password'),
        profile.get('hash') as HashAlgorithm,
        profile.get('hashOptions'),
      ))
    ) {
      throw new Exception(Exception.USER_INVALID_CREDENTIALS)
    }

    if (profile.get('status') === false) {
      throw new Exception(Exception.USER_BLOCKED)
    }

    user.setAll(profile.toObject())

    const duration =
      this.platform.get('auths').duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG
    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN')
    const record = this.geodb.get(request.ip)
    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION)

    const session = new Doc({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      provider: SessionProvider.EMAIL,
      providerUid: email,
      secret: Auth.hash(secret),
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
      factors: ['password'],
      countryCode: record?.country?.iso_code.toLowerCase(),
      expire: new Date(Date.now() + duration * 1000),
      ...detector.getOS(),
      ...detector.getClient(),
      ...detector.getDevice(),
    }) as SessionsDoc

    Authorization.setRole(Role.user(user.getId()).toString())

    if (user.get('hash') !== Auth.DEFAULT_ALGO) {
      user
        .set(
          'password',
          await Auth.passwordHash(
            input.password,
            Auth.DEFAULT_ALGO,
            Auth.DEFAULT_ALGO_OPTIONS,
          ),
        )
        .set('hash', Auth.DEFAULT_ALGO)
        .set('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)
      await this.db.updateDocument('users', user.getId(), user)
    }

    await this.db.purgeCachedDocument('users', user.getId())

    const createdSession = await this.db.createDocument(
      'sessions',
      session.set('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    )

    const expire = new Date(Date.now() + duration * 1000)
    response
      .cookie(Auth.cookieName, Auth.encodeSession(user.getId(), secret), {
        expires: expire,
        path: '/',
        secure: protocol === 'https',
        domain: Auth.cookieDomain,
        sameSite: Auth.cookieSamesite,
        httpOnly: true,
      })
      .status(201)

    const countryName = locale.getText(
      'countries' + session.get('countryCode', '')?.toLowerCase(),
      locale.getText('locale.country.unknown'),
    )

    createdSession
      .set('current', true)
      .set('countryName', countryName)
      .set('secret', Auth.encodeSession(user.getId(), secret))

    if (this.platform.get('auths').sessionAlerts ?? false) {
      const sessionCount = await this.db.count('sessions', qb =>
        qb.equal('userId', user.getId()),
      )

      if (sessionCount !== 1) {
        await this.sendSessionAlert(locale, user, createdSession)
      }
    }

    return createdSession
  }

  /**
   * Create Email Token.
   */
  async createEmailToken({
    user,
    input,
    request,
    response,
    locale,
  }: {
    user: UsersDoc
    input: CreateEmailTokenDTO
    request: NuvixRequest
    response: NuvixRes
    locale: LocaleTranslator
  }) {
    if (!this.appConfig.getSmtpConfig().host) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP disabled')
    }

    const { userId, email, phrase: inputPhrase = false } = input
    let phrase!: string

    if (inputPhrase === true) {
      phrase = PhraseGenerator.generate()
    }

    const result = await this.db.findOne('users', [
      Query.equal('email', [email]),
    ])
    if (!result.empty()) {
      user.setAll(result.toObject())
    } else {
      const limit = this.platform.get('auths')['limit'] ?? 0
      const maxUsers = this.appConfig.appLimits.users ?? 0

      if (limit !== 0) {
        const total = await this.db.count('users', [], maxUsers)

        if (total >= limit) {
          throw new Exception(Exception.USER_COUNT_EXCEEDED)
        }
      }

      // Makes sure this email is not already used in another identity
      const identityWithMatchingEmail = await this.db.findOne('identities', [
        Query.equal('providerEmail', [email]),
      ])
      if (!identityWithMatchingEmail.empty()) {
        throw new Exception(Exception.GENERAL_BAD_REQUEST) // Return a generic bad request to prevent exposing existing accounts
      }

      const finalUserId = userId === 'unique()' ? ID.unique() : userId
      user.setAll({
        $id: finalUserId,
        $permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(finalUserId)),
          Permission.delete(Role.user(finalUserId)),
        ],
        email: email,
        emailVerification: false,
        status: true,
        hash: Auth.DEFAULT_ALGO,
        hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
        registration: new Date(),
        reset: false,
        prefs: {},
        search: [finalUserId, email].join(' '),
        accessedAt: new Date(),
      })

      user.delete('$sequence')
      user = await Authorization.skip(() =>
        this.db.createDocument('users', user),
      )
    }

    const tokenSecret = Auth.codeGenerator(6)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_OTP * 1000)

    const token = new Doc<Tokens>({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      type: TokenType.EMAIL,
      secret: Auth.hash(tokenSecret), // One way hash encryption to protect DB leak
      expire: expire,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
    })

    Authorization.setRole(Role.user(user.getId()).toString())

    const createdToken = await this.db.createDocument(
      'tokens',
      token.set('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    )

    await this.db.purgeCachedDocument('users', user.getId())

    const subject = locale.getText('emails.otpSession.subject')
    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN')
    const agentOs = detector.getOS()
    const agentClient = detector.getClient()
    const agentDevice = detector.getDevice()

    const templatePath = path.join(
      this.appConfig.assetConfig.templates,
      'email-otp.tpl',
    )
    const templateSource = await fs.readFile(templatePath, 'utf8')
    const template = Template.compile(templateSource)

    const emailData = {
      hello: locale.getText('emails.otpSession.hello'),
      description: locale.getText('emails.otpSession.description'),
      clientInfo: locale.getText('emails.otpSession.clientInfo'),
      thanks: locale.getText('emails.otpSession.thanks'),
      signature: locale.getText('emails.otpSession.signature'),
      securityPhrase: phrase
        ? locale.getText('emails.otpSession.securityPhrase')
        : '',
    }

    const body = template(emailData)

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: user.get('name'),
      project: 'Console',
      otp: tokenSecret,
      agentDevice: agentDevice['deviceBrand'] || 'UNKNOWN',
      agentClient: agentClient['clientName'] || 'UNKNOWN',
      agentOs: agentOs['osName'] || 'UNKNOWN',
      phrase: phrase || '',
    }

    await this.mailsQueue.add(MailJob.SEND_EMAIL, {
      email,
      subject,
      body,
      variables: emailVariables,
    })

    createdToken.set('secret', tokenSecret)
    if (phrase) {
      createdToken.set('phrase', phrase)
    }

    response.status(201)
    return createdToken
  }

  /**
   * Send Session Alert.
   */
  async sendSessionAlert(
    locale: LocaleTranslator,
    user: UsersDoc,
    session: SessionsDoc,
  ) {
    const subject: string = locale.getText('emails.sessionAlert.subject')
    const templatePath = path.join(
      this.appConfig.assetConfig.templates,
      'email-session-alert.tpl',
    )
    const templateSource = await fs.readFile(templatePath, 'utf8')
    const template = Template.compile(templateSource)

    const emailData = {
      hello: locale.getText('emails.sessionAlert.hello'),
      body: locale.getText('emails.sessionAlert.body'),
      listDevice: locale.getText('emails.sessionAlert.listDevice'),
      listIpAddress: locale.getText('emails.sessionAlert.listIpAddress'),
      listCountry: locale.getText('emails.sessionAlert.listCountry'),
      footer: locale.getText('emails.sessionAlert.footer'),
      thanks: locale.getText('emails.sessionAlert.thanks'),
      signature: locale.getText('emails.sessionAlert.signature'),
    }

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      date: new Date().toLocaleDateString(locale.default, {
        month: 'long',
        day: 'numeric',
      }),
      year: new Date().getFullYear(),
      time: new Date().toLocaleTimeString(locale.default),
      user: user.get('name'),
      project: 'Console',
      device: session.get('clientName'),
      ipAddress: session.get('ip'),
      country: locale.getText(
        'countries.' + session.get('countryCode'),
        locale.getText('locale.country.unknown'),
      ),
    }

    const body = template(emailData)
    const email = user.get('email')

    await this.mailsQueue.add(MailJob.SEND_EMAIL, {
      email,
      subject,
      body,
      variables: emailVariables,
    })
  }

  /**
   * Create JWT
   */
  async createJWT(user: UsersDoc, response: NuvixRes) {
    const sessions = user.get('sessions', []) as SessionsDoc[]
    let current = new Doc<Sessions>()

    for (const session of sessions) {
      if (session.get('secret') === Auth.hash(Auth.secret)) {
        current = session
        break
      }
    }

    if (current.empty()) {
      throw new Exception(Exception.USER_SESSION_NOT_FOUND)
    }

    const payload = {
      userId: user.getId(),
      sessionId: current.getId(),
    }

    const jwt = this.jwtService.sign(payload, {
      expiresIn: '15m', // 900 seconds
    })

    response.status(201)
    return new Doc({ jwt })
  }

  /**
   * Create a new session for the user
   */
  async createSession({
    user,
    input,
    request,
    response,
    locale,
  }: {
    user: UsersDoc
    input: CreateSessionDTO
    request: NuvixRequest
    response: NuvixRes
    locale: LocaleTranslator
  }) {
    const { userId, secret } = input

    const userFromRequest = await Authorization.skip(() =>
      this.db.getDocument('users', userId),
    )

    if (userFromRequest.empty()) {
      throw new Exception(Exception.USER_INVALID_TOKEN)
    }

    const verifiedToken = Auth.tokenVerify(
      userFromRequest.get('tokens', []),
      null,
      secret,
    )

    if (!verifiedToken) {
      throw new Exception(Exception.USER_INVALID_TOKEN)
    }

    user.setAll(userFromRequest.toObject())

    const duration =
      this.platform.get('auths').duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG
    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN')
    const record = this.geodb.get(request.ip)
    const sessionSecret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION)

    const factor = (() => {
      switch (verifiedToken.get('type') as TokenType) {
        case TokenType.MAGIC_URL:
        case TokenType.OAUTH2:
        case TokenType.EMAIL:
          return AuthFactor.EMAIL
        case TokenType.PHONE:
          return AuthFactor.PHONE
        case TokenType.GENERIC:
          return AuthFactor.TOKEN
        default:
          throw new Exception(Exception.USER_INVALID_TOKEN)
      }
    })()

    const session = new Doc<Sessions>({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      provider: Auth.getSessionProviderByTokenType(verifiedToken.get('type')),
      secret: Auth.hash(sessionSecret),
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
      factors: [factor],
      countryCode: record?.country?.iso_code.toLowerCase(),
      expire: new Date(Date.now() + duration * 1000),
      ...detector.getOS(),
      ...detector.getClient(),
      ...detector.getDevice(),
    })

    Authorization.setRole(Role.user(user.getId()).toString())

    const createdSession = await this.db.createDocument(
      'sessions',
      session.set('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    )

    await Authorization.skip(() =>
      this.db.deleteDocument('tokens', verifiedToken.getId()),
    )
    await this.db.purgeCachedDocument('users', user.getId())

    if (
      [TokenType.MAGIC_URL, TokenType.EMAIL].includes(verifiedToken.get('type'))
    ) {
      user.set('emailVerification', true)
    }

    if (verifiedToken.get('type') === TokenType.PHONE) {
      user.set('phoneVerification', true)
    }

    try {
      await this.db.updateDocument('users', user.getId(), user)
    } catch {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed saving user to DB',
      )
    }

    const isAllowedTokenType = ![TokenType.MAGIC_URL, TokenType.EMAIL].includes(
      verifiedToken.get('type'),
    )
    const hasUserEmail = user.get('email', false) !== false
    const isSessionAlertsEnabled =
      this.platform.get('auths').sessionAlerts ?? false
    const isNotFirstSession =
      (await this.db.count('sessions', [
        Query.equal('userId', [user.getId()]),
      ])) !== 1

    if (
      isAllowedTokenType &&
      hasUserEmail &&
      isSessionAlertsEnabled &&
      isNotFirstSession
    ) {
      await this.sendSessionAlert(locale, user, createdSession)
    }

    // queueForAppEvents.setParam('userId', user.getId()).setParam('sessionId', createdSession.getId());

    const expire = new Date(Date.now() + duration * 1000)
    const protocol = request.protocol

    response
      .cookie(
        Auth.cookieName,
        Auth.encodeSession(user.getId(), sessionSecret),
        {
          expires: new Date(expire),
          path: '/',
          domain: Auth.cookieDomain,
          secure: protocol === 'https',
          httpOnly: true,
          sameSite: Auth.cookieSamesite,
        },
      )
      .status(201)

    const countryName = locale.getText(
      'countries.' + createdSession.get('countryCode', '')?.toLowerCase(),
      locale.getText('locale.country.unknown'),
    )

    createdSession
      .set('current', true)
      .set('countryName', countryName)
      .set('expire', expire)

    return createdSession
  }

  /**
   * Create email verification token
   */
  async createEmailVerification({
    user,
    request,
    response,
    locale,
    url,
  }: WithReqRes<WithUser<WithLocale<{ url?: string }>>>) {
    if (!this.appConfig.getSmtpConfig().host) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP Disabled')
    }

    if (user.get('emailVerification')) {
      throw new Exception(Exception.USER_EMAIL_ALREADY_VERIFIED)
    }

    const verificationSecret = Auth.tokenGenerator(
      Auth.TOKEN_LENGTH_VERIFICATION,
    )
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_CONFIRM * 1000)

    const verification = new Doc({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      type: TokenType.VERIFICATION,
      secret: Auth.hash(verificationSecret), // One way hash encryption to protect DB leak
      expire: expire,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
    })

    Authorization.setRole(Role.user(user.getId()).toString())

    const createdVerification = await this.db.createDocument(
      'tokens',
      verification.set('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    )

    await this.db.purgeCachedDocument('users', user.getId())
    url ??= `${request.protocol}://${request.host}`

    // Parse and merge URL query parameters
    const urlObj = new URL(url)
    urlObj.searchParams.set('userId', user.getId())
    urlObj.searchParams.set('secret', verificationSecret)
    urlObj.searchParams.set('expire', expire.toISOString())
    const finalUrl = urlObj.toString()

    const projectName = 'Console'
    let body = locale.getText('emails.verification.body')
    const subject = locale.getText('emails.verification.subject')

    const templatePath = path.join(
      this.appConfig.assetConfig.templates,
      'email-inner-base.tpl',
    )
    const templateSource = await fs.readFile(templatePath, 'utf8')
    const template = Template.compile(templateSource)

    const emailData = {
      body: body,
      hello: locale.getText('emails.verification.hello'),
      footer: locale.getText('emails.verification.footer'),
      thanks: locale.getText('emails.verification.thanks'),
      signature: locale.getText('emails.verification.signature'),
    }

    body = template(emailData)
    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: user.get('name'),
      redirect: finalUrl,
      project: projectName,
      team: '',
    }

    await this.mailsQueue.add(MailJob.SEND_EMAIL, {
      email: user.get('email'),
      subject,
      body,
      variables: emailVariables,
    })

    createdVerification.set('secret', verificationSecret)
    // @typescript-eslint/no-unused-vars
    response.status(201)
    return createdVerification
  }

  /**
   * Verify email
   */
  async updateEmailVerification({
    user,
    response,
    userId,
    secret,
  }: WithUser<{ response: NuvixRes; userId: string; secret: string }>) {
    const profile = await Authorization.skip(() =>
      this.db.getDocument('users', userId),
    )

    if (profile.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const tokens = profile.get('tokens', []) as TokensDoc[]
    const verifiedToken = Auth.tokenVerify(
      tokens,
      TokenType.VERIFICATION,
      secret,
    )

    if (!verifiedToken) {
      throw new Exception(Exception.USER_INVALID_TOKEN)
    }

    Authorization.setRole(Role.user(profile.getId()).toString())

    const updatedProfile = await this.db.updateDocument(
      'users',
      profile.getId(),
      profile.set('emailVerification', true),
    )

    user.setAll(updatedProfile.toObject())

    const verification = await this.db.getDocument(
      'tokens',
      verifiedToken.getId(),
    )

    /**
     * We act like we're updating and validating
     * the verification token but actually we don't need it anymore.
     */
    await this.db.deleteDocument('tokens', verifiedToken.getId())
    await this.db.purgeCachedDocument('users', profile.getId())

    return verification
  }
}

type WithReqRes<T = unknown> = {
  request: NuvixRequest
  response: NuvixRes
} & T
type WithUser<T = unknown> = { user: UsersDoc } & T
type WithLocale<T = unknown> = { locale: LocaleTranslator } & T
