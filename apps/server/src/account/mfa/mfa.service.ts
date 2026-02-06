import * as fs from 'node:fs/promises'
import path from 'node:path'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '@nuvix/core'
import type { SmtpConfig } from '@nuvix/core/config'
import { Exception } from '@nuvix/core/extend/exception'
import { Auth, Detector, LocaleTranslator } from '@nuvix/core/helpers'
import { MailJob, MailQueueOptions } from '@nuvix/core/resolvers'
import { MfaType, TOTP } from '@nuvix/core/validators'
import { Database, Doc, ID, Permission, Role } from '@nuvix/db'
import { QueueFor } from '@nuvix/utils'
import {
  EmailChallenge,
  PhoneChallenge,
  TOTPChallenge,
} from '@nuvix/utils/auth'
import type {
  AuthenticatorsDoc,
  ChallengesDoc,
  ProjectsDoc,
  SessionsDoc,
  UsersDoc,
} from '@nuvix/utils/types'
import { Queue } from 'bullmq'
import * as Template from 'handlebars'
import { CreateMfaChallengeDTO, VerifyMfaChallengeDTO } from './DTO/mfa.dto'

@Injectable()
export class MfaService {
  constructor(
    private readonly appConfig: AppConfigService,
    @InjectQueue(QueueFor.MAILS)
    private readonly mailsQueue: Queue<MailQueueOptions>,
  ) {}

  /**
   * Update MFA
   */
  async updateMfa({
    db,
    user,
    mfa,
    session,
  }: WithDB<
    WithUser<{ mfa: boolean; session?: SessionsDoc }>
  >): Promise<UsersDoc> {
    user.set('mfa', mfa)

    user = await db.updateDocument('users', user.getId(), user)

    if (mfa && session) {
      let factors = session.get('factors', [])

      const totp = TOTP.getAuthenticatorFromUser(user)
      if (totp?.get('verified', false)) {
        factors.push('totp')
      }

      if (user.get('email', false) && user.get('emailVerification', false)) {
        factors.push('email')
      }

      if (user.get('phone', false) && user.get('phoneVerification', false)) {
        factors.push('phone')
      }

      factors = [...new Set(factors)] // Ensure unique factors

      session.set('factors', factors)
      await db.updateDocument('sessions', session.getId(), session)
    }

    return user
  }

  /**
   * Get Mfa factors
   */
  async getMfaFactors(user: UsersDoc): Promise<
    Doc<{
      totp: boolean
      email: boolean
      phone: boolean
      recoveryCode: boolean
    }>
  > {
    const mfaRecoveryCodes = user.get('mfaRecoveryCodes', [])
    const recoveryCodeEnabled =
      Array.isArray(mfaRecoveryCodes) && mfaRecoveryCodes.length > 0

    const totp = TOTP.getAuthenticatorFromUser(user)

    const factors = new Doc({
      totp: totp?.get('verified', false) ?? false,
      email: user.get('email', false)
        ? user.get('emailVerification', false)
        : false,
      phone: user.get('phone', false)
        ? user.get('phoneVerification', false)
        : false,
      recoveryCode: recoveryCodeEnabled,
    })

    return factors
  }

  /**
   * Create authenticator
   */
  async createMfaAuthenticator({
    db,
    user,
    type,
    project,
  }: WithDB<WithUser<WithProject<{ type: string }>>>): Promise<
    Doc<{ secret: string; uri: string }>
  > {
    let otp: TOTP

    switch (type) {
      case MfaType.TOTP:
        otp = new TOTP()
        break
      default:
        throw new Exception(Exception.GENERAL_ARGUMENT_INVALID, 'Unknown type.')
    }

    otp.setLabel(user.get('email'))
    otp.setIssuer(project.get('name'))

    const authenticator = TOTP.getAuthenticatorFromUser(user)

    if (authenticator) {
      if (authenticator.get('verified')) {
        throw new Exception(Exception.USER_AUTHENTICATOR_ALREADY_VERIFIED)
      }
      await db.deleteDocument('authenticators', authenticator.getId())
    }

    const newAuthenticator = new Doc({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      type: MfaType.TOTP,
      verified: false,
      data: {
        secret: otp.getSecret(),
      },
      $permissions: [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ],
    })

    const model = new Doc({
      secret: otp.getSecret(),
      uri: otp.getProvisioningUri(),
    })

    await db.createDocument('authenticators', newAuthenticator)
    await db.purgeCachedDocument('users', user.getId())

    return model
  }

  /**
   * Update authenticator (confirmation)
   */
  async verifyMfaAuthenticator({
    type,
    otp,
    user,
    session,
    db,
  }: WithDB<
    WithUser<{ session: SessionsDoc; otp: string; type: string }>
  >): Promise<UsersDoc> {
    let authenticator: AuthenticatorsDoc | null = null

    switch (type) {
      case MfaType.TOTP:
        authenticator = TOTP.getAuthenticatorFromUser(user)
        break
      default:
        authenticator = null
    }

    if (!authenticator) {
      throw new Exception(Exception.USER_AUTHENTICATOR_NOT_FOUND)
    }

    if (authenticator.get('verified')) {
      throw new Exception(Exception.USER_AUTHENTICATOR_ALREADY_VERIFIED)
    }

    let success = false
    switch (type) {
      case MfaType.TOTP:
        success = await TOTPChallenge.verify(user, otp)
        break
      default:
        success = false
    }

    if (!success) {
      throw new Exception(Exception.USER_INVALID_TOKEN)
    }

    authenticator.set('verified', true)

    await db.updateDocument(
      'authenticators',
      authenticator.getId(),
      authenticator,
    )
    await db.purgeCachedDocument('users', user.getId())

    const factors = session.get('factors', [])
    factors.push(type)
    const uniqueFactors = [...new Set(factors)]

    session.set('factors', uniqueFactors)
    await db.updateDocument('sessions', session.getId(), session)

    return user
  }

  /**
   * Create MFA recovery codes
   */
  async createMfaRecoveryCodes({
    user,
    db,
  }: WithDB<WithUser>): Promise<Doc<{ recoveryCodes: string[] }>> {
    const mfaRecoveryCodes = user.get('mfaRecoveryCodes', [])

    if (mfaRecoveryCodes.length > 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_ALREADY_EXISTS)
    }

    const newRecoveryCodes = TOTP.generateBackupCodes()
    user.set('mfaRecoveryCodes', newRecoveryCodes)
    await db.updateDocument('users', user.getId(), user)

    const document = new Doc({
      recoveryCodes: newRecoveryCodes,
    })

    return document
  }

  /**
   * Update MFA recovery codes (regenerate)
   */
  async updateMfaRecoveryCodes({
    user,
    db,
  }: WithDB<WithUser>): Promise<Doc<{ recoveryCodes: string[] }>> {
    const mfaRecoveryCodes = user.get('mfaRecoveryCodes', [])

    if (mfaRecoveryCodes.length === 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND)
    }

    const newMfaRecoveryCodes = TOTP.generateBackupCodes()
    user.set('mfaRecoveryCodes', newMfaRecoveryCodes)
    await db.updateDocument('users', user.getId(), user)

    const document = new Doc({
      recoveryCodes: newMfaRecoveryCodes,
    })

    return document
  }

  /**
   * Delete Authenticator
   */
  async deleteMfaAuthenticator({
    user,
    db,
    type,
  }: WithDB<WithUser<{ type: string }>>): Promise<void> {
    const authenticator = (() => {
      switch (type) {
        case MfaType.TOTP:
          return TOTP.getAuthenticatorFromUser(user)
        default:
          return null
      }
    })()

    if (!authenticator) {
      throw new Exception(Exception.USER_AUTHENTICATOR_NOT_FOUND)
    }

    await db.deleteDocument('authenticators', authenticator.getId())
    await db.purgeCachedDocument('users', user.getId())
  }

  /**
   * Create MFA Challenge
   */
  async createMfaChallenge({
    db,
    user,
    userAgent,
    locale,
    project,
    factor,
  }: WithDB<
    WithUser<
      WithProject<WithLocale<CreateMfaChallengeDTO & { userAgent: string }>>
    >
  >): Promise<ChallengesDoc> {
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_CONFIRM * 1000)
    const code = Auth.codeGenerator(6)

    const challenge: ChallengesDoc = new Doc({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      type: factor,
      token: Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION),
      code: code,
      expire: expire,
      $permissions: [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ],
    })

    const createdChallenge = await db.createDocument('challenges', challenge)

    switch (factor) {
      case TOTP.PHONE: {
        if (!this.appConfig.get('sms').enabled) {
          throw new Exception(
            Exception.GENERAL_PHONE_DISABLED,
            'Phone provider not configured',
          )
        }
        if (!user.get('phone')) {
          throw new Exception(Exception.USER_PHONE_NOT_FOUND)
        }
        if (!user.get('phoneVerification')) {
          throw new Exception(Exception.USER_PHONE_NOT_VERIFIED)
        }

        const customSmsTemplate =
          project.get('templates', {})[`sms.mfaChallenge-${locale.default}`] ??
          {}

        let smsMessage = locale.getText('sms.verification.body')
        if (customSmsTemplate?.message) {
          smsMessage = customSmsTemplate.message
        }

        const smsContent = smsMessage
          .replace('{{project}}', project.get('name'))
          .replace('{{secret}}', code)

        const phone = user.get('phone')

        // TODO: Implement SMS queue functionality
        console.log(`SMS MFA Challenge to ${phone}: ${smsContent}`)

        // TODO: Implement usage metrics and abuse tracking
        break
      }

      case TOTP.EMAIL: {
        if (!this.appConfig.getSmtpConfig().host) {
          throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP disabled')
        }
        if (!user.get('email')) {
          throw new Exception(Exception.USER_EMAIL_NOT_FOUND)
        }
        if (!user.get('emailVerification')) {
          throw new Exception(Exception.USER_EMAIL_NOT_VERIFIED)
        }

        let subject = locale.getText('emails.mfaChallenge.subject')
        const customEmailTemplate =
          project.get('templates', {})[
            `email.mfaChallenge-${locale.default}`
          ] ?? {}

        const detector = new Detector(userAgent)
        const agentOs = detector.getOS()
        const agentClient = detector.getClient()
        const agentDevice = detector.getDevice()

        const templatePath = path.join(
          this.appConfig.assetConfig.templates,
          'email-mfa-challenge.tpl',
        )
        const templateSource = await fs.readFile(templatePath, 'utf8')
        const template = Template.compile(templateSource)

        const emailData = {
          hello: locale.getText('emails.mfaChallenge.hello'),
          description: locale.getText('emails.mfaChallenge.description'),
          clientInfo: locale.getText('emails.mfaChallenge.clientInfo'),
          thanks: locale.getText('emails.mfaChallenge.thanks'),
          signature: locale.getText('emails.mfaChallenge.signature'),
        }

        let body = template(emailData)

        const smtp = project.get('smtp', {}) as SmtpConfig
        const smtpEnabled = smtp.enabled ?? false
        const systemConfig = this.appConfig.get('system')

        let senderEmail =
          systemConfig.emailAddress || this.appConfig.get('app').emailTeam
        let senderName =
          systemConfig.emailName || `${this.appConfig.get('app').name} Server`
        let replyTo = ''

        const smtpServer: SmtpConfig = {} as SmtpConfig

        if (smtpEnabled) {
          if (smtp.senderEmail) {
            senderEmail = smtp.senderEmail
          }
          if (smtp.senderName) {
            senderName = smtp.senderName
          }
          if (smtp.replyTo) {
            replyTo = smtp.replyTo
          }

          smtpServer.host = smtp.host
          smtpServer.port = smtp.port
          smtpServer.username = smtp.username
          smtpServer.password = smtp.password
          smtpServer.secure = smtp.secure ?? false

          if (customEmailTemplate) {
            if (customEmailTemplate.senderEmail) {
              senderEmail = customEmailTemplate.senderEmail
            }
            if (customEmailTemplate.senderName) {
              senderName = customEmailTemplate.senderName
            }
            if (customEmailTemplate.replyTo) {
              replyTo = customEmailTemplate.replyTo
            }

            body = customEmailTemplate.message || body
            subject = customEmailTemplate.subject || subject
          }

          smtpServer.replyTo = replyTo
          smtpServer.senderEmail = senderEmail
          smtpServer.senderName = senderName
        }

        const emailVariables = {
          direction: locale.getText('settings.direction'),
          user: user.get('name'),
          project: project.get('name'),
          otp: code,
          agentDevice: agentDevice.deviceBrand || 'UNKNOWN',
          agentClient: agentClient.clientName || 'UNKNOWN',
          agentOs: agentOs.osName || 'UNKNOWN',
        }

        await this.mailsQueue.add(MailJob.SEND_EMAIL, {
          email: user.get('email'),
          subject,
          body,
          server: smtpServer,
          variables: emailVariables,
        })
        break
      }
    }

    // TODO: Handle Events
    // await this.eventEmitter.emit(EVENT_MFA_CHALLENGE_CREATE, {
    //   userId: user.getId(),
    //   challengeId: createdChallenge.getId(),
    // });

    return createdChallenge
  }

  /**
   * Update MFA Challenge
   */
  async updateMfaChallenge({
    db,
    user,
    session,
    otp,
    challengeId,
  }: WithDB<
    WithUser<VerifyMfaChallengeDTO & { session: SessionsDoc }>
  >): Promise<SessionsDoc> {
    const challenge = await db.getDocument('challenges', challengeId)

    if (challenge.empty()) {
      throw new Exception(Exception.USER_INVALID_TOKEN)
    }

    const type = challenge.get('type')

    const recoveryCodeChallenge = async (
      challenge: ChallengesDoc,
      user: UsersDoc,
      otp: string,
    ): Promise<boolean> => {
      if (
        challenge.has('type') &&
        challenge.get('type') === MfaType.RECOVERY_CODE.toLowerCase()
      ) {
        let mfaRecoveryCodes = user.get('mfaRecoveryCodes', [])
        if (mfaRecoveryCodes.includes(otp)) {
          mfaRecoveryCodes = mfaRecoveryCodes.filter(code => code !== otp)
          user.set('mfaRecoveryCodes', mfaRecoveryCodes)
          await db.updateDocument('users', user.getId(), user)
          return true
        }
        return false
      }
      return false
    }

    let success = false
    switch (type) {
      case MfaType.TOTP:
        success = await TOTPChallenge.challenge(challenge, user, otp)
        break
      case MfaType.PHONE:
        success =
          (await PhoneChallenge.challenge(challenge, user, otp)) &&
          challenge.get('code') === otp &&
          new Date() < new Date(challenge.get('expire') as string)
        break
      case MfaType.EMAIL:
        success =
          (await EmailChallenge.challenge(challenge, user, otp)) &&
          challenge.get('code') === otp &&
          new Date() < new Date(challenge.get('expire') as string)
        break
      case MfaType.RECOVERY_CODE.toLowerCase():
        success = await recoveryCodeChallenge(challenge, user, otp)
        break
      default:
        success = false
    }

    if (!success) {
      throw new Exception(Exception.USER_INVALID_TOKEN)
    }

    await db.deleteDocument('challenges', challengeId)
    await db.purgeCachedDocument('users', user.getId())

    let factors = session.get('factors', [])
    factors.push(type)
    factors = [...new Set(factors)] // Remove duplicates

    session.set('factors', factors).set('mfaUpdatedAt', new Date())

    await db.updateDocument('sessions', session.getId(), session)

    // TODO: Handle Events
    // await this.eventEmitter.emit(EVENT_MFA_CHALLENGE_VERIFY, {
    //   userId: user.getId(),
    //   sessionId: session.getId(),
    // });

    return session
  }
}

type WithDB<T = unknown> = { db: Database } & T
type WithUser<T = unknown> = { user: UsersDoc } & T
type WithProject<T = unknown> = { project: ProjectsDoc } & T
type WithLocale<T = unknown> = { locale: LocaleTranslator } & T
