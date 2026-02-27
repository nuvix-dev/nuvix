import * as fs from 'node:fs'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { AppConfigService, CoreService } from '@nuvix/core'
import type { SmtpConfig } from '@nuvix/core/config'
import { Exception } from '@nuvix/core/extend/exception'
import { Auth, Detector, ID, LocaleTranslator } from '@nuvix/core/helpers'
import { MailJob, MailQueueOptions } from '@nuvix/core/resolvers'
import { TOTP } from '@nuvix/core/validators'
import {
  Authorization,
  AuthorizationException,
  Database,
  Doc,
  DuplicateException,
  Permission,
  Query,
  Role,
} from '@nuvix/db'
import { configuration, QueueFor, SessionProvider } from '@nuvix/utils'
import type { Memberships, ProjectsDoc, UsersDoc } from '@nuvix/utils/types'
import type { Queue } from 'bullmq'
import Template from 'handlebars'
import { sprintf } from 'sprintf-js'
import {
  CreateMembershipDTO,
  UpdateMembershipDTO,
  UpdateMembershipStatusDTO,
} from './DTO/membership.dto'

@Injectable()
export class MembershipsService {
  constructor(
    private readonly coreService: CoreService,
    @InjectQueue(QueueFor.MAILS)
    private readonly mailsQueue: Queue<MailQueueOptions, any, MailJob>,
  ) {}

  /**
   * Add a member to the team
   */
  async addMember(
    id: string,
    input: CreateMembershipDTO,

    user: UsersDoc,
    locale: LocaleTranslator,
  ) {
    const url = input.url ? input.url.trim() : ''
    if (!url) {
      if (!Auth.isTrustedActor) {
        throw new Exception(
          Exception.GENERAL_ARGUMENT_INVALID,
          'URL is required',
        )
      }
    }

    if (!input.userId && !input.email && !input.phone) {
      throw new Exception(
        Exception.GENERAL_ARGUMENT_INVALID,
        'At least one of userId, email, or phone is required',
      )
    }

    if (!Auth.isTrustedActor && !configuration.smtp.enabled()) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED)
    }

    const team = await this.db.getDocument('teams', id)
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    let email = input.email ? input.email.trim().toLowerCase() : ''
    let name = input.name ? input.name.trim() : email
    let invitee: UsersDoc | null = null

    if (input.userId) {
      invitee = await this.db.getDocument('users', input.userId)
      if (invitee.empty()) {
        throw new Exception(Exception.USER_NOT_FOUND)
      }
      if (email && invitee.get('email') !== email) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given userId and email do not match',
          409,
        )
      }
      if (input.phone && invitee.get('phone') !== input.phone) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given userId and phone do not match',
          409,
        )
      }
      email = invitee.get('email', '')
      input.phone = invitee.get('phone', '')
      name = !name ? invitee.get('name', '') : name
    } else if (input.email) {
      invitee = await this.db.findOne('users', [Query.equal('email', [email])])
      if (
        !invitee.empty() &&
        input.phone &&
        invitee.get('phone') !== input.phone
      ) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given email and phone do not match',
          409,
        )
      }
    } else if (input.phone) {
      invitee = await this.db.findOne('users', [
        Query.equal('phone', [input.phone]),
      ])
      if (!invitee.empty() && email && invitee.get('email') !== email) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given phone and email do not match',
          409,
        )
      }
    }

    if (!invitee || invitee.empty()) {
      const userId = ID.unique()

      // Check user limit if not privileged or app user
      const limit = project.get('auths', {}).limit ?? 0
      if (!Auth.isTrustedActor && limit !== 0) {
        const total = await this.db.count('users', [])
        if (total >= limit) {
          throw new Exception(
            Exception.USER_COUNT_EXCEEDED,
            'User registration is restricted. Contact your administrator for more information.',
          )
        }
      }

      // Ensure email is not already used in another identity
      const identityWithMatchingEmail = await this.db.findOne('identities', [
        Query.equal('providerEmail', [email]),
      ])
      if (identityWithMatchingEmail && !identityWithMatchingEmail.empty()) {
        throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS)
      }

      try {
        invitee = await this.db.createDocument(
          'users',
          new Doc({
            $id: userId,
            $permissions: [
              Permission.read(Role.any()),
              Permission.read(Role.user(userId)),
              Permission.update(Role.user(userId)),
              Permission.delete(Role.user(userId)),
            ],
            email: email,
            phone: input.phone,
            emailVerification: false,
            status: true,
            registration: new Date(),
            reset: false,
            name: name,
            prefs: {},
            search: [userId, email, input.phone, name]
              .filter(Boolean)
              .join(' '),
          }),
        )
      } catch (error) {
        if (error instanceof DuplicateException) {
          throw new Exception(Exception.USER_ALREADY_EXISTS)
        }
        throw error
      }
    }

    const isOwner = Authorization.isRole(`team:${team.getId()}/owner`)

    if (!isOwner && !Auth.isTrustedActor) {
      throw new Exception(
        Exception.USER_UNAUTHORIZED,
        'User is not allowed to send invitations for this team',
      )
    }

    const membershipId = ID.unique()
    const secret = Auth.tokenGenerator()

    let membership = new Doc<Memberships>({
      $id: membershipId,
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(invitee.getId())),
        Permission.update(Role.team(team.getId(), 'owner')),
        Permission.delete(Role.user(invitee.getId())),
        Permission.delete(Role.team(team.getId(), 'owner')),
      ],
      userId: invitee.getId(),
      userInternalId: invitee.getSequence(),
      teamId: team.getId(),
      teamInternalId: team.getSequence(),
      roles: input.roles,
      invited: new Date(),
      joined: Auth.isTrustedActor ? new Date() : null,
      confirm: Auth.isTrustedActor,
      secret: Auth.hash(secret),
      search: [membershipId, invitee.getId()].join(' '),
    })

    if (Auth.isTrustedActor) {
      try {
        membership = await Authorization.skip(() =>
          this.db.createDocument('memberships', membership),
        )
      } catch (error) {
        if (error instanceof DuplicateException) {
          throw new Exception(Exception.TEAM_INVITE_ALREADY_EXISTS)
        }
        throw error
      }

      await Authorization.skip(() =>
        this.db.increaseDocumentAttribute('teams', team.getId(), 'total', 1),
      )
      await this.db.purgeCachedDocument('users', invitee.getId())
    } else {
      try {
        membership = await this.db.createDocument('memberships', membership)
      } catch (error) {
        if (error instanceof DuplicateException) {
          throw new Exception(Exception.TEAM_INVITE_ALREADY_EXISTS)
        }
        throw error
      }

      const url = new URL(input.url || '')
      url.searchParams.append('membershipId', membership.getId())
      url.searchParams.append('userId', invitee.getId())
      url.searchParams.append('secret', secret)
      url.searchParams.append('teamId', team.getId())

      const email = invitee.get('email')
      if (email) {
        const projectName = project.empty()
          ? 'Console'
          : project.get('name', '[APP-NAME]')
        let subject = sprintf(
          locale.getText('emails.invitation.subject'),
          team.get('name'),
          projectName,
        )
        const customTemplate =
          project.get('templates', {})?.[
            `email.invitation-${locale.default}`
          ] ?? {}
        const templatePath = `${this.appConfig.assetConfig.templates}/email-inner-base.tpl`
        const templateSource = fs.readFileSync(templatePath, 'utf8')
        const template = Template.compile(templateSource)

        const emailData = {
          hello: locale.getText('emails.invitation.hello'),
          body: locale.getText('emails.invitation.body'),
          footer: locale.getText('emails.invitation.footer'),
          thanks: locale.getText('emails.invitation.thanks'),
          signature: locale.getText('emails.invitation.signature'),
        }

        let body = template(emailData)

        const smtp = project.get('smtp', {}) as SmtpConfig
        const smtpEnabled = smtp.enabled ?? false
        const systemConfig = this.appConfig.get('system')

        let senderEmail =
          systemConfig.emailAddress || configuration.app.emailTeam
        let senderName =
          systemConfig.emailName || `${configuration.app.name} Server`
        let replyTo = ''

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
        }

        const emailVariables = {
          owner: user.get('name'),
          direction: locale.getText('settings.direction'),
          user: invitee.get('name'),
          team: team.get('name'),
          redirect: url.toString(),
          project: projectName,
        }

        await this.mailsQueue.add(MailJob.SEND_EMAIL, {
          email,
          subject,
          body,
          server: {
            host: smtp.host,
            port: smtp.port,
            username: smtp.username,
            password: smtp.password,
            secure: smtp.secure,
            from: senderEmail,
            replyTo,
            senderEmail,
            senderName,
          },
          variables: emailVariables,
        })
      }
    }

    membership
      .set('teamName', team.get('name'))
      .set('userName', invitee.get('name'))
      .set('userEmail', invitee.get('email'))

    return membership
  }

  /**
   * Get all members of the team
   */
  async getMembers(id: string, queries: Query[], search?: string) {
    const team = await this.db.getDocument('teams', id)
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    if (search) {
      queries.push(Query.search('search', search))
    }
    queries.push(Query.equal('teamInternalId', [team.getSequence()]))

    const filterQueries = Query.groupByType(queries).filters
    const memberships = await this.db.find('memberships', queries)
    const total = await this.db.count('memberships', filterQueries)

    const validMemberships = memberships
      .filter(membership => membership.get('userId'))
      .map(async membership => {
        const user = await this.db.getDocument(
          'users',
          membership.get('userId'),
        )

        let mfa = user.get('mfa', false)
        if (mfa) {
          const totp = TOTP.getAuthenticatorFromUser(user)
          const totpEnabled = totp?.get('verified', false)
          const emailEnabled =
            user.get('email') && user.get('emailVerification')
          const phoneEnabled =
            user.get('phone') && user.get('phoneVerification')

          if (!totpEnabled && !emailEnabled && !phoneEnabled) {
            mfa = false
          }
        }

        membership
          .set('mfa', mfa)
          .set('teamName', team.get('name'))
          .set('userName', user.get('name'))
          .set('userEmail', user.get('email'))

        return membership
      })

    return {
      data: await Promise.all(validMemberships),
      total: total,
    }
  }

  /**
   * Get A member of the team
   */
  async getMember(teamId: string, memberId: string) {
    const team = await this.db.getDocument('teams', teamId)
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    const membership = await this.db.getDocument('memberships', memberId)
    if (membership.empty() || !membership.get('userId')) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND)
    }

    const user = await this.db.getDocument('users', membership.get('userId'))

    let mfa = user.get('mfa', false)
    if (mfa) {
      const totp = TOTP.getAuthenticatorFromUser(user)
      const totpEnabled = totp?.get('verified', false)
      const emailEnabled = user.get('email') && user.get('emailVerification')
      const phoneEnabled = user.get('phone') && user.get('phoneVerification')

      if (!totpEnabled && !emailEnabled && !phoneEnabled) {
        mfa = false
      }
    }

    membership
      .set('mfa', mfa)
      .set('teamName', team.get('name'))
      .set('userName', user.get('name'))
      .set('userEmail', user.get('email'))

    return membership
  }

  /**
   * Update member of the team
   */
  async updateMember(
    teamId: string,
    memberId: string,
    input: UpdateMembershipDTO,
  ) {
    const team = await this.db.getDocument('teams', teamId)
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    const membership = await this.db.getDocument('memberships', memberId)
    if (membership.empty()) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND)
    }

    const user = await this.db.getDocument('users', membership.get('userId'))
    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }
    const isOwner = Authorization.isRole(`team:${team.getId()}/owner`)

    if (!isOwner && !Auth.isTrustedActor) {
      throw new Exception(
        Exception.USER_UNAUTHORIZED,
        'User is not allowed to modify roles',
      )
    }

    membership.set('roles', input.roles)
    const updatedMembership = await this.db.updateDocument(
      'memberships',
      membership.getId(),
      membership,
    )

    await this.db.purgeCachedDocument('users', user.getId())

    updatedMembership
      .set('teamName', team.get('name'))
      .set('userName', user.get('name'))
      .set('userEmail', user.get('email'))

    return updatedMembership
  }

  /**
   * Update Membership Status
   */
  async updateMemberStatus(
    teamId: string,
    memberId: string,
    { userId, secret }: UpdateMembershipStatusDTO,
    request: NuvixRequest,
    response: NuvixRes,
    user: UsersDoc,
  ): Promise<Doc<Memberships>> {
    const protocol = request.protocol
    const membership = await this.db.getDocument('memberships', memberId)

    if (membership.empty()) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND)
    }

    const team = await Authorization.skip(() =>
      this.db.getDocument('teams', teamId),
    )

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    if (membership.get('teamInternalId') !== team.getSequence()) {
      throw new Exception(Exception.TEAM_MEMBERSHIP_MISMATCH)
    }

    if (Auth.hash(secret) !== membership.get('secret')) {
      throw new Exception(Exception.TEAM_INVALID_SECRET)
    }

    if (userId !== membership.get('userId')) {
      throw new Exception(
        Exception.TEAM_INVITE_MISMATCH,
        `Invite does not belong to current user (${user.get('email')})`,
      )
    }

    const hasSession = !user.empty()
    if (!hasSession) {
      const userData = await this.db.getDocument('users', userId)
      user.setAll(userData.toObject())
    }

    if (membership.get('userInternalId') !== user.getSequence()) {
      throw new Exception(
        Exception.TEAM_INVITE_MISMATCH,
        `Invite does not belong to current user (${user.get('email')})`,
      )
    }

    if (membership.get('confirm') === true) {
      throw new Exception(Exception.MEMBERSHIP_ALREADY_CONFIRMED)
    }

    membership.set('joined', new Date()).set('confirm', true)

    await Authorization.skip(() =>
      this.db.updateDocument(
        'users',
        user.getId(),
        user.set('emailVerification', true),
      ),
    )

    // Create session for the user if not logged in
    if (!hasSession) {
      Authorization.setRole(Role.user(user.getId()).toString())

      const detector = new Detector(request.headers['user-agent'] ?? 'UNKNWON')
      const record = this.coreService.getGeoDb().get(request.ip)
      const authDuration =
        project.get('auths', {}).duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG
      const expire = new Date(Date.now() + authDuration * 1000)
      const sessionSecret = Auth.tokenGenerator()

      const sessionDoc = new Doc({
        $id: ID.unique(),
        $permissions: [
          Permission.read(Role.user(user.getId())),
          Permission.update(Role.user(user.getId())),
          Permission.delete(Role.user(user.getId())),
        ],
        userId: user.getId(),
        userInternalId: user.getSequence(),
        provider: SessionProvider.EMAIL,
        providerUid: user.get('email'),
        secret: Auth.hash(sessionSecret),
        userAgent: request.headers['user-agent'] || 'UNKNWON',
        ip: request.ip,
        factors: ['email'],
        countryCode: record ? record.country?.iso_code?.toLowerCase() : '--',
        expire: expire,
        ...detector.getClient(),
        ...detector.getOS(),
        ...detector.getDevice(),
      })

      await this.db.createDocument('sessions', sessionDoc)
      Authorization.setRole(Role.user(userId).toString())

      const domainVerification = request.domainVerification
      if (!domainVerification) {
        response.header(
          'X-Fallback-Cookies',
          JSON.stringify({
            [Auth.cookieName]: Auth.encodeSession(user.getId(), sessionSecret),
          }),
        )
      }

      const cookieDomain = Auth.cookieDomain
      const cookieSamesite = Auth.cookieSamesite

      response.setCookie(
        Auth.cookieName,
        Auth.encodeSession(user.getId(), sessionSecret),
        {
          expires: new Date(Math.floor(expire.getTime() / 1000)),
          path: '/',
          domain: cookieDomain,
          secure: protocol === 'https',
          httpOnly: true,
          sameSite: cookieSamesite,
        },
      )
    }

    const updatedMembership = await this.db.updateDocument(
      'memberships',
      membership.getId(),
      membership,
    )

    await this.db.purgeCachedDocument('users', user.getId())

    await Authorization.skip(() =>
      this.db.increaseDocumentAttribute('teams', team.getId(), 'total', 1),
    )

    return updatedMembership
      .set('teamName', team.get('name'))
      .set('userName', user.get('name'))
      .set('userEmail', user.get('email')) as Doc<Memberships>
  }

  /**
   * Delete member of the team
   */
  async deleteMember(teamId: string, memberId: string) {
    const team = await this.db.getDocument('teams', teamId)
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    const membership = await this.db.getDocument('memberships', memberId)
    if (membership.empty()) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND)
    }

    const user = await this.db.getDocument('users', membership.get('userId'))
    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    if (membership.get('teamInternalId') !== team.getSequence()) {
      throw new Exception(Exception.TEAM_MEMBERSHIP_MISMATCH)
    }

    try {
      await this.db.deleteDocument('memberships', membership.getId())
    } catch (error) {
      if (error instanceof AuthorizationException) {
        throw new Exception(Exception.USER_UNAUTHORIZED)
      }
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove membership from DB',
      )
    }

    await this.db.purgeCachedDocument('users', user.getId())

    if (membership.get('confirm')) {
      await this.db.decreaseDocumentAttribute(
        'teams',
        team.getId(),
        'total',
        1,
        0,
      )
    }
  }
}
