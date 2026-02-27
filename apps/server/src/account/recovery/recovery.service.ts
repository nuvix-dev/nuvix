import * as fs from 'node:fs/promises'
import path from 'node:path'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'

import type { SmtpConfig } from '@nuvix/core/config'
import { Exception } from '@nuvix/core/extend/exception'
import { Hooks } from '@nuvix/core/extend/hooks'
import { Auth, LocaleTranslator } from '@nuvix/core/helpers'
import { MailJob, MailQueueOptions } from '@nuvix/core/resolvers'
import { PasswordHistoryValidator } from '@nuvix/core/validators'
import {
  Authorization,
  Database,
  Doc,
  ID,
  Permission,
  Query,
  Role,
} from '@nuvix/db'
import { type HashAlgorithm, QueueFor, TokenType } from '@nuvix/utils'
import type {
  ProjectsDoc,
  Tokens,
  TokensDoc,
  UsersDoc,
} from '@nuvix/utils/types'
import { Queue } from 'bullmq'
import Template from 'handlebars'
import { CreateRecoveryDTO, UpdateRecoveryDTO } from './DTO/recovery.dto'

@Injectable()
export class RecoveryService {
  constructor(
    private readonly appConfig: AppConfigService,
    @InjectQueue(QueueFor.MAILS)
    private readonly mailsQueue: Queue<MailQueueOptions>,
  ) {}

  /**
   * Create Recovery
   */
  async createRecovery({
    user,
    project,
    locale,
    ip,
    userAgent,
    input,
  }: WithDB<
    WithUser<
      WithProject<
        WithLocale<{
          input: CreateRecoveryDTO
          ip?: string
          userAgent: string
        }>
      >
    >
  >): Promise<TokensDoc> {
    if (!this.appConfig.getSmtpConfig().host) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP disabled')
    }

    const email = input.email.toLowerCase()
    let url = input.url

    if (!url) {
      throw new Exception(Exception.GENERAL_BAD_REQUEST, 'url is required')
    }

    const profile = await db.findOne('users', [Query.equal('email', [email])])

    if (profile.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    user.setAll(profile.toObject())

    if (profile.get('status') === false) {
      throw new Exception(Exception.USER_BLOCKED)
    }

    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_RECOVERY * 1000)
    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_RECOVERY)

    const recovery = new Doc<Tokens>({
      $id: ID.unique(),
      userId: profile.getId(),
      userInternalId: profile.getSequence(),
      type: TokenType.RECOVERY,
      secret: Auth.hash(secret), // One way hash encryption to protect DB leak
      expire: expire,
      userAgent,
      ip,
    })

    Authorization.setRole(Role.user(profile.getId()).toString())

    recovery.set('$permissions', [
      Permission.read(Role.user(profile.getId())),
      Permission.update(Role.user(profile.getId())),
      Permission.delete(Role.user(profile.getId())),
    ])
    const createdRecovery = await db.createDocument('tokens', recovery)

    await db.purgeCachedDocument('users', profile.getId())

    // Parse and merge URL query parameters
    const urlObj = new URL(url)
    urlObj.searchParams.set('userId', profile.getId())
    urlObj.searchParams.set('secret', secret)
    urlObj.searchParams.set('expire', expire.toISOString())
    url = urlObj.toString()

    const projectName = project.empty()
      ? 'Console'
      : project.get('name', '[APP-NAME]')
    let body = locale.getText('emails.recovery.body')
    let subject = locale.getText('emails.recovery.subject')
    const customTemplate =
      project.get('templates', {})[`email.recovery-${locale.default}`] ?? {}

    const templatePath = path.join(
      this.appConfig.assetConfig.templates,
      'email-inner-base.tpl',
    )
    const templateSource = await fs.readFile(templatePath, 'utf8')
    const template = Template.compile(templateSource)

    const emailData = {
      body: body,
      hello: locale.getText('emails.recovery.hello'),
      footer: locale.getText('emails.recovery.footer'),
      thanks: locale.getText('emails.recovery.thanks'),
      signature: locale.getText('emails.recovery.signature'),
    }

    body = template(emailData)

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

      if (customTemplate) {
        if (customTemplate.senderEmail) {
          senderEmail = customTemplate.senderEmail
        }
        if (customTemplate.senderName) {
          senderName = customTemplate.senderName
        }
        if (customTemplate.replyTo) {
          replyTo = customTemplate.replyTo
        }

        body = customTemplate.message || body
        subject = customTemplate.subject || subject
      }

      smtpServer.replyTo = replyTo
      smtpServer.senderEmail = senderEmail
      smtpServer.senderName = senderName
    }

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: profile.get('name'),
      redirect: url,
      project: projectName,
      team: '',
    }

    await this.mailsQueue.add(MailJob.SEND_EMAIL, {
      email: profile.get('email', ''),
      subject,
      body,
      server: smtpServer,
      variables: emailVariables,
    })

    createdRecovery.set(
      'secret',
      Auth.isPlatformActor || Auth.isTrustedActor ? secret : undefined,
    )

    return createdRecovery
  }

  /**
   * Update password recovery (confirmation)
   */
  async updateRecovery({
    project,
    user,
    input,
  }: WithDB<
    WithProject<WithUser<{ input: UpdateRecoveryDTO }>>
  >): Promise<TokensDoc> {
    const profile = await db.getDocument('users', input.userId)

    if (profile.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const tokens = profile.get('tokens', []) as TokensDoc[]
    const verifiedToken = Auth.tokenVerify(
      tokens,
      TokenType.RECOVERY,
      input.secret,
    )

    if (!verifiedToken) {
      throw new Exception(Exception.USER_INVALID_TOKEN)
    }

    Authorization.setRole(Role.user(profile.getId()).toString())

    const newPassword = await Auth.passwordHash(
      input.password,
      Auth.DEFAULT_ALGO,
      Auth.DEFAULT_ALGO_OPTIONS,
    )

    const historyLimit = project.get('auths', {}).passwordHistory ?? 0
    let history = profile.get('passwordHistory', [])

    if (newPassword && historyLimit > 0) {
      const validator = new PasswordHistoryValidator(
        history,
        profile.get('hash') as HashAlgorithm,
        profile.get('hashOptions'),
      )
      if (!(await validator.$valid(input.password))) {
        throw new Exception(Exception.USER_PASSWORD_RECENTLY_USED)
      }

      history.push(newPassword)
      history = history.slice(Math.max(0, history.length - historyLimit))
    }

    await Hooks.trigger('passwordValidator', [
      project,
      input.password,
      user,
      true,
    ])

    const updatedProfile = await db.updateDocument(
      'users',
      profile.getId(),
      profile
        .set('password', newPassword)
        .set('passwordHistory', history)
        .set('passwordUpdate', new Date())
        .set('hash', Auth.DEFAULT_ALGO)
        .set('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)
        .set('emailVerification', true),
    )

    user.setAll(updatedProfile.toObject())
    const recoveryDocument = await db.getDocument(
      'tokens',
      verifiedToken.getId(),
    )

    /**
     * We act like we're updating and validating
     * the recovery token but actually we don't need it anymore.
     */
    await db.deleteDocument('tokens', verifiedToken.getId())
    await db.purgeCachedDocument('users', profile.getId())

    return recoveryDocument
  }
}

type WithDB<T = unknown> = T
type WithUser<T = unknown> = { user: UsersDoc } & T
type WithProject<T = unknown> = { project: ProjectsDoc } & T
type WithLocale<T = unknown> = { locale: LocaleTranslator } & T
