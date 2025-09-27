import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import * as Template from 'handlebars'
import * as fs from 'fs/promises'
import path from 'path'
import {
  Doc,
  Database,
  Query,
  ID,
  Permission,
  Role,
  Authorization,
  DuplicateException,
} from '@nuvix/db'
import { Exception } from '@nuvix/core/extend/exception'
import { Auth } from '@nuvix/core/helper/auth.helper'
import { LocaleTranslator } from '@nuvix/core/helper/locale.helper'
import { PersonalDataValidator } from '@nuvix/core/validators/personal-data.validator'
import { PasswordHistoryValidator } from '@nuvix/core/validators'
import {
  MailJob,
  MailQueueOptions,
} from '@nuvix/core/resolvers/queues/mails.queue'
import {
  configuration,
  QueueFor,
  TokenType,
  type HashAlgorithm,
} from '@nuvix/utils'
import { UpdateEmailDTO } from './DTO/account.dto'
import type {
  ProjectsDoc,
  TargetsDoc,
  Tokens,
  TokensDoc,
  UsersDoc,
} from '@nuvix/utils/types'
import { AppConfigService } from '@nuvix/core'
import type { SmtpConfig } from '@nuvix/core/config/smtp.js'

@Injectable()
export class AccountService {
  constructor(
    private readonly appConfig: AppConfigService,
    private eventEmitter: EventEmitter2,
    @InjectQueue(QueueFor.MAILS)
    private readonly mailsQueue: Queue<MailQueueOptions>,
  ) {}

  /**
   * Create a new account
   */
  async createAccount(
    db: Database,
    userId: string,
    email: string,
    password: string,
    name: string | undefined,
    user: UsersDoc,
    project: ProjectsDoc,
  ): Promise<UsersDoc> {
    email = email.toLowerCase()

    const auths = project.get('auths', {})
    const limit = auths['limit'] ?? 0
    const maxUser = this.appConfig.appLimits.users

    if (limit !== 0) {
      const total = await db.count('users', [], maxUser)
      if (total >= limit) {
        throw new Exception(Exception.USER_COUNT_EXCEEDED)
      }
    }

    // Makes sure this email is not already used in another identity
    const identityWithMatchingEmail = await db.findOne('identities', qb =>
      qb.equal('providerEmail', email),
    )

    if (identityWithMatchingEmail && !identityWithMatchingEmail.empty()) {
      throw new Exception(Exception.GENERAL_BAD_REQUEST) // Return a generic bad request to prevent exposing existing accounts
    }

    if (auths['personalDataCheck'] ?? false) {
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

    // hooks.trigger('passwordValidator', [db, project, password, user, true]);

    const passwordHistory = auths['passwordHistory'] ?? 0
    const hashedPassword = await Auth.passwordHash(
      password,
      Auth.DEFAULT_ALGO,
      Auth.DEFAULT_ALGO_OPTIONS,
    )

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
        password: hashedPassword ?? undefined,
        passwordHistory:
          passwordHistory > 0 ? ([hashedPassword] as string[]) : [],
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
      user = await Authorization.skip(() => db.createDocument('users', user))

      try {
        const target = await Authorization.skip(() =>
          db.createDocument(
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
            }),
          ),
        )
        user.set('targets', [...user.get('targets', []), target])
      } catch (error) {
        if (error instanceof DuplicateException) {
          const existingTarget = await db.findOne('targets', [
            Query.equal('identifier', [email]),
          ])
          if (existingTarget) {
            user.append('targets', existingTarget)
          }
        } else {
          throw error
        }
      }

      await db.purgeCachedDocument('users', user.getId())
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_ALREADY_EXISTS)
      }
      throw error
    }

    Authorization.unsetRole(Role.guests().toString())
    Authorization.setRole(Role.user(user.getId()).toString())
    Authorization.setRole(Role.users().toString())

    return user
  }

  async updatePrefs(
    db: Database,
    user: UsersDoc,
    prefs: Record<string, string | number | boolean>,
  ) {
    user.set('prefs', prefs)

    user = await db.updateDocument('users', user.getId(), user)

    return user.get('prefs', {})
  }

  async deleteAccount(db: Database, user: UsersDoc) {
    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    if (user.get('status') === false) {
      throw new Exception(Exception.USER_BLOCKED)
    }

    await db.deleteDocument('users', user.getId())
    return
  }

  /**
   * Update User's Email
   */
  async updateEmail(db: Database, user: UsersDoc, input: UpdateEmailDTO) {
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

    const identityWithMatchingEmail = await db.findOne('identities', [
      Query.equal('providerEmail', [email]),
      Query.notEqual('userInternalId', user.getSequence()),
    ])

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
      db.findOne('targets', [Query.equal('identifier', [email])]),
    )

    if (target && !target.empty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS)
    }

    try {
      user = await db.updateDocument('users', user.getId(), user)
      const oldTarget = user.findWhere(
        'targets',
        (t: TargetsDoc) => t.get('identifier') === oldEmail,
      )

      if (oldTarget && !oldTarget.empty()) {
        await Authorization.skip(
          async () =>
            await db.updateDocument(
              'targets',
              oldTarget.getId(),
              oldTarget.set('identifier', email),
            ),
        )
      }
      await db.purgeCachedDocument('users', user.getId())
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.GENERAL_BAD_REQUEST)
      } else {
        throw error
      }
    }
  }

  /**
   * Update User Name.
   */
  async updateName(db: Database, name: string, user: UsersDoc) {
    user.set('name', name)

    user = await db.updateDocument('users', user.getId(), user)

    // TODO: Trigger Event

    return user
  }

  /**
   * Update user password.
   */
  async updatePassword({
    password,
    oldPassword,
    user,
    project,
    db,
  }: {
    password: string
    oldPassword: string
    user: UsersDoc
    project: ProjectsDoc
    db: Database
  }) {
    // Check old password only if its an existing user.
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

    const newPassword = await Auth.passwordHash(
      password,
      Auth.DEFAULT_ALGO,
      Auth.DEFAULT_ALGO_OPTIONS,
    )
    const historyLimit = project.get('auths', {})['passwordHistory'] ?? 0
    const history = user.get('passwordHistory', [])

    if (newPassword && historyLimit > 0) {
      const validator = new PasswordHistoryValidator(
        history,
        user.get('hash') as HashAlgorithm,
        user.get('hashOptions'),
      )
      if (!(await validator.$valid(password))) {
        throw new Exception(Exception.USER_PASSWORD_RECENTLY_USED)
      }

      history.push(newPassword)
      history.splice(0, Math.max(0, history.length - historyLimit))
    }

    if (project.get('auths', {})['personalDataCheck'] ?? false) {
      const personalDataValidator = new PersonalDataValidator(
        user.getId(),
        user.get('email'),
        user.get('name'),
        user.get('phone'),
      )
      if (!personalDataValidator.$valid(password)) {
        throw new Exception(Exception.USER_PASSWORD_PERSONAL_DATA)
      }
    }

    // hooks.trigger('passwordValidator', [db, project, password, user, true]);

    user
      .set('password', newPassword)
      .set('passwordHistory', history)
      .set('passwordUpdate', new Date())
      .set('hash', Auth.DEFAULT_ALGO)
      .set('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)

    user = await db.updateDocument('users', user.getId(), user)

    return user
  }

  /**
   * Update User's Phone.
   */
  async updatePhone({
    password,
    phone,
    user,
    project,
    db,
  }: {
    password: string
    phone: string
    user: UsersDoc
    project: ProjectsDoc
    db: Database
  }) {
    // passwordUpdate will be empty if the user has never set a password
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
      // Double check user password
      throw new Exception(Exception.USER_INVALID_CREDENTIALS)
    }

    // hooks.trigger('passwordValidator', [db, project, password, user, false]);

    const target = await Authorization.skip(
      async () =>
        await db.findOne('targets', [Query.equal('identifier', [phone])]),
    )

    if (!target.empty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS)
    }

    const oldPhone = user.get('phone')

    user.set('phone', phone).set('phoneVerification', false) // After this user needs to confirm phone number again

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
      user = await db.updateDocument('users', user.getId(), user)
      const oldTarget = user.findWhere(
        'targets',
        (t: TargetsDoc) => t.get('identifier') === oldPhone,
      )

      if (oldTarget && !oldTarget.empty()) {
        await Authorization.skip(() =>
          db.updateDocument(
            'targets',
            oldTarget.getId(),
            oldTarget.set('identifier', phone),
          ),
        )
      }
      await db.purgeCachedDocument('users', user.getId())
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_PHONE_ALREADY_EXISTS)
      }
      throw error
    }

    return user
  }

  /**
   * Update Status
   */
  async updateStatus({
    db,
    user,
    request,
    response,
  }: {
    db: Database
    user: UsersDoc
    request: NuvixRequest
    response: NuvixRes
  }) {
    user.set('status', false)

    user = await db.updateDocument('users', user.getId(), user)

    if (!request.domainVerification) {
      response.header('X-Fallback-Cookies', JSON.stringify([]))
    }

    const protocol = request.protocol
    response.cookie(Auth.cookieName, '', {
      expires: new Date(Date.now() - 3600000),
      path: '/',
      domain: Auth.cookieDomain,
      secure: protocol === 'https',
      httpOnly: true,
      sameSite: Auth.cookieSamesite,
    })

    return user
  }

  /**
   * Create email verification token
   */
  async createEmailVerification({
    db,
    user,
    request,
    response,
    locale,
    project,
    url,
  }: WithDB<WithReqRes<WithUser<WithProject<WithLocale<{ url?: string }>>>>>) {
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

    const verification = new Doc<Tokens>({
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

    const createdVerification = await db.createDocument(
      'tokens',
      verification.set('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    )

    await db.purgeCachedDocument('users', user.getId())
    url ??= `${request.protocol}://${request.host}`

    // Parse and merge URL query parameters
    const urlObj = new URL(url)
    urlObj.searchParams.set('userId', user.getId())
    urlObj.searchParams.set('secret', verificationSecret)
    urlObj.searchParams.set('expire', expire.toISOString())
    const finalUrl = urlObj.toString()

    const projectName = project.empty()
      ? 'Console'
      : project.get('name', '[APP-NAME]')
    let body = locale.getText('emails.verification.body')
    let subject = locale.getText('emails.verification.subject')
    const customTemplate =
      project.get('templates', {})[`email.verification-${locale.default}`] ?? {}

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

    const smtp = project.get('smtp', {}) as SmtpConfig
    const smtpEnabled = smtp['enabled'] ?? false
    const systemConfig = this.appConfig.get('system')

    let senderEmail = systemConfig.emailAddress || configuration.app.emailTeam
    let senderName =
      systemConfig.emailName || configuration.app.name + ' Server'
    let replyTo = ''

    const smtpServer: SmtpConfig = {} as SmtpConfig

    if (smtpEnabled) {
      if (smtp['senderEmail']) senderEmail = smtp['senderEmail']
      if (smtp['senderName']) senderName = smtp['senderName']
      if (smtp['replyTo']) replyTo = smtp['replyTo']

      smtpServer['host'] = smtp['host']
      smtpServer['port'] = smtp['port']
      smtpServer['username'] = smtp['username']
      smtpServer['password'] = smtp['password']
      smtpServer['secure'] = smtp['secure'] ?? false

      if (customTemplate) {
        if (customTemplate['senderEmail'])
          senderEmail = customTemplate['senderEmail']
        if (customTemplate['senderName'])
          senderName = customTemplate['senderName']
        if (customTemplate['replyTo']) replyTo = customTemplate['replyTo']

        body = customTemplate['message'] || body
        subject = customTemplate['subject'] || subject
      }

      smtpServer['replyTo'] = replyTo
      smtpServer['senderEmail'] = senderEmail
      smtpServer['senderName'] = senderName
    }

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
      server: smtpServer,
      variables: emailVariables,
    })

    createdVerification.set('secret', verificationSecret)

    response.status(201)
    return createdVerification
  }

  /**
   * Verify email
   */
  async updateEmailVerification({
    db,
    user,
    response,
    userId,
    secret,
  }: WithDB<WithUser<{ response: NuvixRes; userId: string; secret: string }>>) {
    const profile = await Authorization.skip(() =>
      db.getDocument('users', userId),
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

    const updatedProfile = await db.updateDocument(
      'users',
      profile.getId(),
      profile.set('emailVerification', true),
    )

    user.setAll(updatedProfile.toObject())

    const verification = await db.getDocument('tokens', verifiedToken.getId())

    /**
     * We act like we're updating and validating
     * the verification token but actually we don't need it anymore.
     */
    await db.deleteDocument('tokens', verifiedToken.getId())
    await db.purgeCachedDocument('users', profile.getId())

    return verification
  }

  /**
   * Create phone verification token
   */
  async createPhoneVerification({
    db,
    user,
    request,
    response,
    locale,
    project,
  }: WithDB<WithReqRes<WithUser<WithProject<WithLocale<{}>>>>>) {
    // Check if SMS provider is configured
    if (!this.appConfig.get('sms').enabled) {
      throw new Exception(
        Exception.GENERAL_PHONE_DISABLED,
        'Phone provider not configured',
      )
    }

    const phone = user.get('phone')
    if (!phone) {
      throw new Exception(Exception.USER_PHONE_NOT_FOUND)
    }

    if (user.get('phoneVerification')) {
      throw new Exception(Exception.USER_PHONE_ALREADY_VERIFIED)
    }

    let secret: string | null = null
    let sendSMS = true
    const mockNumbers = project.get('auths', {})['mockNumbers'] ?? []

    for (const mockNumber of mockNumbers) {
      if (mockNumber['phone'] === phone) {
        secret = mockNumber['otp']
        sendSMS = false
        break
      }
    }

    secret = secret ?? Auth.codeGenerator(6)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_CONFIRM * 1000)

    const verification = new Doc({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      type: TokenType.PHONE,
      secret: Auth.hash(secret),
      expire: expire,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
    })

    Authorization.setRole(Role.user(user.getId()).toString())

    const createdVerification = await db.createDocument(
      'tokens',
      verification.set('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    )

    await db.purgeCachedDocument('users', user.getId())

    if (sendSMS) {
      const customTemplate =
        project.get('templates', {})[`sms.verification-${locale.default}`] ?? {}

      let message = locale.getText('sms.verification.body')
      if (customTemplate && customTemplate['message']) {
        message = customTemplate['message']
      }

      const messageContent = message
        .replace('{{project}}', project.get('name'))
        .replace('{{secret}}', secret)

      // TODO: Implement SMS queue functionality
      console.log(`SMS to ${phone}: ${messageContent}`)
    }

    createdVerification.set('secret', secret)

    response.status(201)
    return createdVerification
  }

  /**
   * Verify phone number
   */
  async updatePhoneVerification({
    db,
    user,
    userId,
    secret,
  }: WithDB<WithUser<{ userId: string; secret: string }>>) {
    const profile = await Authorization.skip(() =>
      db.getDocument('users', userId),
    )

    if (profile.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const tokens = user.get('tokens', []) as TokensDoc[]
    const verifiedToken = Auth.tokenVerify(tokens, TokenType.PHONE, secret)

    if (!verifiedToken) {
      throw new Exception(Exception.USER_INVALID_TOKEN)
    }

    Authorization.setRole(Role.user(profile.getId()).toString())

    const updatedProfile = await db.updateDocument(
      'users',
      profile.getId(),
      profile.set('phoneVerification', true),
    )

    user.setAll(updatedProfile.toObject())

    const verificationDocument = await db.getDocument(
      'tokens',
      verifiedToken.getId(),
    )

    /**
     * We act like we're updating and validating the verification token but actually we don't need it anymore.
     */
    await db.deleteDocument('tokens', verifiedToken.getId())
    await db.purgeCachedDocument('users', profile.getId())

    return verificationDocument
  }
}

type WithDB<T = unknown> = { db: Database } & T
type WithReqRes<T = unknown> = {
  request: NuvixRequest
  response: NuvixRes
} & T
type WithUser<T = unknown> = { user: UsersDoc } & T
type WithProject<T = unknown> = { project: ProjectsDoc } & T
type WithLocale<T = unknown> = { locale: LocaleTranslator } & T
