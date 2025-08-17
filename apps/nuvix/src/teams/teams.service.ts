import { Injectable, Logger } from '@nestjs/common';
import {
  CreateTeamDTO,
  UpdateTeamDTO,
  UpdateTeamPrefsDTO,
} from './DTO/team.dto';
import { ID } from '@nuvix/core/helper/ID.helper';
import { Exception } from '@nuvix/core/extend/exception';
import { TOTP } from '@nuvix/core/validators/MFA.validator';
import {
  CreateMembershipDTO,
  UpdateMembershipDTO,
  UpdateMembershipStatusDTO,
} from './DTO/membership.dto';
import {
  APP_EMAIL_TEAM,
  APP_NAME,
  QueueFor,
} from '@nuvix/utils';
import {
  Authorization,
  AuthorizationException,
  Database,
  Doc,
  DuplicateException,
  Permission,
  Query,
  Role,
} from '@nuvix-tech/db';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  MailJob,
  MailQueueOptions,
} from '@nuvix/core/resolvers/queues/mails.queue';
import { LocaleTranslator } from '@nuvix/core/helper/locale.helper';
import { sprintf } from 'sprintf-js';
import * as fs from 'fs';
import * as Template from 'handlebars';
import { AppConfigService } from '@nuvix/core';
import type { Memberships, ProjectsDoc, UsersDoc } from '@nuvix/utils/types';
import type { SmtpConfig } from '@nuvix/core/config/smtp.js';

@Injectable()
export class TeamsService {
  private logger: Logger = new Logger(TeamsService.name);

  constructor(
    private readonly appConfig: AppConfigService,
    @InjectQueue(QueueFor.MAILS)
    private readonly mailsQueue: Queue<MailQueueOptions, any, MailJob>,
  ) {}

  /**
   * Find all teams
   */
  async findAll(db: Database, queries: Query[], search?: string) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    const filterQueries = Query.groupByType(queries)['filters'];
    const results = await db.find('teams', queries);
    const total = await db.count('teams', filterQueries);

    return {
      teams: results,
      total: total,
    };
  }

  /**
   * Create a new team
   */
  async create(
    db: Database,
    user: UsersDoc | null,
    input: CreateTeamDTO,
    mode: string,
  ) {
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());
    const isAppUser = Auth.isAppUser(Authorization.getRoles());

    const teamId = input.teamId == 'unique()' ? ID.unique() : input.teamId;

    const team = await db
      .createDocument(
        'teams',
        new Doc({
          $id: teamId,
          $permissions: [
            Permission.read(Role.team(teamId)),
            Permission.update(Role.team(teamId, 'owner')),
            Permission.delete(Role.team(teamId, 'owner')),
          ],
          name: input.name,
          total: isPrivilegedUser || isAppUser ? 0 : 1,
          prefs: {},
          search: [teamId, input.name].join(' '),
        }),
      )
      .catch(error => {
        if (error instanceof DuplicateException) {
          throw new Exception(Exception.TEAM_ALREADY_EXISTS);
        }
        throw error;
      });

    if (!isPrivilegedUser && !isAppUser && user && mode !== 'admin') {
      // Don't add user on server mode
      if (!input.roles.includes('owner')) {
        input.roles.push('owner');
      }

      const membershipId = ID.unique();
      await db.createDocument(
        'memberships',
        new Doc({
          $id: membershipId,
          $permissions: [
            Permission.read(Role.user(user.getId())),
            Permission.read(Role.team(team.getId())),
            Permission.update(Role.user(user.getId())),
            Permission.update(Role.team(team.getId(), 'owner')),
            Permission.delete(Role.user(user.getId())),
            Permission.delete(Role.team(team.getId(), 'owner')),
          ],
          userId: user.getId(),
          userInternalId: user.getSequence(),
          teamId: team.getId(),
          teamInternalId: team.getSequence(),
          roles: input.roles,
          invited: new Date(),
          joined: new Date(),
          confirm: true,
          secret: '',
          search: [membershipId, user.getId()].join(' '),
        }),
      );

      await db.purgeCachedDocument('users', user.getId());
    }

    return team;
  }

  /**
   * Update team
   */
  async update(db: Database, id: string, input: UpdateTeamDTO) {
    const team = await db.getDocument('teams', id);

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    team.set('name', input.name);
    team.set('search', [id, input.name].join(' '));

    const updatedTeam = await db.updateDocument('teams', team.getId(), team);

    return updatedTeam;
  }

  /**
   * Remove team
   */
  async remove(db: Database, id: string) {
    const team = await db.getDocument('teams', id);

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const deleted = await db.deleteDocument('teams', id);
    if (!deleted) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove team from DB',
      );
    }

    // Delete all memberships associated with this team
    const membershipQueries = [Query.equal('teamId', [team.getId()])];
    const memberships = await db.find('memberships', membershipQueries);
    for (const membership of memberships) {
      await db.deleteDocument('memberships', membership.getId());
    }

    return;
  }

  /**
   * Find a team by id
   */
  async findOne(db: Database, id: string) {
    const team = await db.getDocument('teams', id);

    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    return team;
  }

  /**
   * Get team preferences
   */
  async getPrefs(db: Database, id: string) {
    const team = await db.getDocument('teams', id);

    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    return team.get('prefs', {});
  }

  /**
   * Set team preferences
   */
  async setPrefs(db: Database, id: string, { prefs }: UpdateTeamPrefsDTO) {
    const team = await db.getDocument('teams', id);

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    team.set('prefs', prefs);
    const updatedTeam = await db.updateDocument('teams', team.getId(), team);

    return updatedTeam.get('prefs');
  }

  /**
   * Add a member to the team
   */
  async addMember(
    db: Database,
    id: string,
    input: CreateMembershipDTO,
    project: ProjectsDoc,
    user: UsersDoc,
    locale: LocaleTranslator,
  ) {
    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    const url = input.url ? input.url.trim() : '';
    if (!url) {
      if (!isAPIKey && !isPrivilegedUser) {
        throw new Exception(
          Exception.GENERAL_ARGUMENT_INVALID,
          'URL is required',
        );
      }
    }

    const isAppUser = Auth.isAppUser(Authorization.getRoles());

    if (!input.userId && !input.email && !input.phone) {
      throw new Exception(
        Exception.GENERAL_ARGUMENT_INVALID,
        'At least one of userId, email, or phone is required',
      );
    }

    if (!isPrivilegedUser && !isAppUser && !this.appConfig.getSmtpConfig().host) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED);
    }

    const team = await db.getDocument('teams', id);
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    let email = input.email ? input.email.trim().toLowerCase() : '';
    let name = input.name ? input.name.trim() : email;
    let invitee: UsersDoc | null = null;

    if (input.userId) {
      invitee = await db.getDocument('users', input.userId);
      if (invitee.empty()) {
        throw new Exception(Exception.USER_NOT_FOUND);
      }
      if (email && invitee.get('email') !== email) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given userId and email do not match',
          409,
        );
      }
      if (input.phone && invitee.get('phone') !== input.phone) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given userId and phone do not match',
          409,
        );
      }
      email = invitee.get('email', '');
      input.phone = invitee.get('phone', '');
      name = !name ? invitee.get('name', '') : name;
    } else if (input.email) {
      invitee = await db.findOne('users', [Query.equal('email', [email])]);
      if (
        !invitee.empty() &&
        input.phone &&
        invitee.get('phone') !== input.phone
      ) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given email and phone do not match',
          409,
        );
      }
    } else if (input.phone) {
      invitee = await db.findOne('users', [
        Query.equal('phone', [input.phone]),
      ]);
      if (
        !invitee.empty() &&
        email &&
        invitee.get('email') !== email
      ) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given phone and email do not match',
          409,
        );
      }
    }

    if (!invitee || invitee.empty()) {
      const userId = ID.unique();

      // Check user limit if not privileged or app user
      const limit = project.get('auths', {})['limit'] ?? 0;
      if (!isPrivilegedUser && !isAppUser && limit !== 0) {
        const total = await db.count('users', []);
        if (total >= limit) {
          throw new Exception(
            Exception.USER_COUNT_EXCEEDED,
            'Project registration is restricted. Contact your administrator for more information.',
          );
        }
      }

      // Ensure email is not already used in another identity
      const identityWithMatchingEmail = await db.findOne('identities', [
        Query.equal('providerEmail', [email]),
      ]);
      if (identityWithMatchingEmail && !identityWithMatchingEmail.empty()) {
        throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS);
      }

      try {
        invitee = await db.createDocument(
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
        );
      } catch (error) {
        if (error instanceof DuplicateException) {
          throw new Exception(Exception.USER_ALREADY_EXISTS);
        } else throw error;
      }
    }

    const isOwner = Authorization.isRole('team:' + team.getId() + '/owner');

    if (!isOwner && !isPrivilegedUser && !isAppUser) {
      throw new Exception(
        Exception.USER_UNAUTHORIZED,
        'User is not allowed to send invitations for this team',
      );
    }

    const membershipId = ID.unique();
    const secret = Auth.tokenGenerator();

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
      joined: isPrivilegedUser || isAppUser ? new Date() : null,
      confirm: isPrivilegedUser || isAppUser,
      secret: Auth.hash(secret),
      search: [membershipId, invitee.getId()].join(' '),
    });

    if (isPrivilegedUser || isAppUser) {
      try {
        membership = await Authorization.skip(
          () => db.createDocument('memberships', membership),
        );
      } catch (error) {
        if (error instanceof DuplicateException) {
          throw new Exception(Exception.TEAM_INVITE_ALREADY_EXISTS);
        }
        throw error;
      }

      await Authorization.skip(
        () =>
          db.increaseDocumentAttribute('teams', team.getId(), 'total', 1),
      );
      await db.purgeCachedDocument('users', invitee.getId());
    } else {
      try {
        membership = await db.createDocument('memberships', membership);
      } catch (error) {
        if (error instanceof DuplicateException) {
          throw new Exception(Exception.TEAM_INVITE_ALREADY_EXISTS);
        }
        throw error;
      }

      const url = new URL(input.url || '');
      url.searchParams.append('membershipId', membership.getId());
      url.searchParams.append('userId', invitee.getId());
      url.searchParams.append('secret', secret);
      url.searchParams.append('teamId', team.getId());

      const email = invitee.get('email');
      if (email) {
        const projectName = project.empty()
          ? 'Console'
          : project.get('name', '[APP-NAME]');
        let subject = sprintf(
          locale.getText('emails.invitation.subject'),
          team.get('name'),
          projectName,
        );
        const customTemplate =
          project.get('templates', {})?.[
          'email.invitation-' + locale.default
          ] ?? {};
        const templatePath = this.appConfig.assetConfig.templates
          + '/email-inner-base.tpl';
        const templateSource = fs.readFileSync(templatePath, 'utf8');
        const template = Template.compile(templateSource);

        const emailData = {
          hello: locale.getText('emails.invitation.hello'),
          body: locale.getText('emails.invitation.body'),
          footer: locale.getText('emails.invitation.footer'),
          thanks: locale.getText('emails.invitation.thanks'),
          signature: locale.getText('emails.invitation.signature'),
        };

        let body = template(emailData);

        const smtp = project.get('smtp', {}) as SmtpConfig;
        const smtpEnabled = smtp['enabled'] ?? false;
        const systemConfig = this.appConfig.get('system');

        let senderEmail =
          systemConfig.emailAddress || APP_EMAIL_TEAM;
        let senderName =
          systemConfig.emailName || APP_NAME + ' Server';
        let replyTo = '';

        if (smtpEnabled) {
          if (smtp['senderEmail']) senderEmail = smtp['senderEmail'];
          if (smtp['senderName']) senderName = smtp['senderName'];
          if (smtp['replyTo']) replyTo = smtp['replyTo'];

          if (customTemplate) {
            if (customTemplate['senderEmail'])
              senderEmail = customTemplate['senderEmail'];
            if (customTemplate['senderName'])
              senderName = customTemplate['senderName'];
            if (customTemplate['replyTo']) replyTo = customTemplate['replyTo'];

            body = customTemplate['message'] || body;
            subject = customTemplate['subject'] || subject;
          }
        }

        const emailVariables = {
          owner: user.get('name'),
          direction: locale.getText('settings.direction'),
          user: invitee.get('name'),
          team: team.get('name'),
          redirect: url.toString(),
          project: projectName,
        };

        await this.mailsQueue.add(MailJob.SEND_EMAIL, {
          email,
          subject,
          body,
          server: {
            host: smtp['host'],
            port: smtp['port'],
            username: smtp['username'],
            password: smtp['password'],
            secure: smtp['secure'],
            from: senderEmail,
            replyTo,
            senderEmail,
            senderName,
          },
          variables: emailVariables,
        });
      }
    }

    membership
      .set('teamName', team.get('name'))
      .set('userName', invitee.get('name'))
      .set('userEmail', invitee.get('email'));

    return membership;
  }

  /**
   * Get all members of the team
   */
  async getMembers(
    db: Database,
    id: string,
    queries: Query[],
    search?: string,
  ) {
    const team = await db.getDocument('teams', id);
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    if (search) {
      queries.push(Query.search('search', search));
    }
    queries.push(Query.equal('teamInternalId', [team.getSequence()]));

    const filterQueries = Query.groupByType(queries)['filters'];
    const memberships = await db.find('memberships', queries);
    const total = await db.count('memberships', filterQueries);

    const validMemberships = memberships
      .filter(membership => membership.get('userId'))
      .map(async membership => {
        const user = await db.getDocument(
          'users',
          membership.get('userId'),
        );

        let mfa = user.get('mfa', false);
        if (mfa) {
          const totp = TOTP.getAuthenticatorFromUser(user);
          const totpEnabled = totp && totp.get('verified', false);
          const emailEnabled =
            user.get('email') &&
            user.get('emailVerification');
          const phoneEnabled =
            user.get('phone') &&
            user.get('phoneVerification');

          if (!totpEnabled && !emailEnabled && !phoneEnabled) {
            mfa = false;
          }
        }

        membership
          .set('mfa', mfa)
          .set('teamName', team.get('name'))
          .set('userName', user.get('name'))
          .set('userEmail', user.get('email'));

        return membership;
      });

    return {
      memberships: await Promise.all(validMemberships),
      total: total,
    };
  }

  /**
   * Get A member of the team
   */
  async getMember(db: Database, teamId: string, memberId: string) {
    const team = await db.getDocument('teams', teamId);
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const membership = await db.getDocument('memberships', memberId);
    if (membership.empty() || !membership.get('userId')) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND);
    }

    const user = await db.getDocument(
      'users',
      membership.get('userId'),
    );

    let mfa = user.get('mfa', false);
    if (mfa) {
      const totp = TOTP.getAuthenticatorFromUser(user);
      const totpEnabled = totp && totp.get('verified', false);
      const emailEnabled =
        user.get('email') && user.get('emailVerification');
      const phoneEnabled =
        user.get('phone') && user.get('phoneVerification');

      if (!totpEnabled && !emailEnabled && !phoneEnabled) {
        mfa = false;
      }
    }

    membership
      .set('mfa', mfa)
      .set('teamName', team.get('name'))
      .set('userName', user.get('name'))
      .set('userEmail', user.get('email'));

    return membership;
  }

  /**
   * Update member of the team
   */
  async updateMember(
    db: Database,
    teamId: string,
    memberId: string,
    input: UpdateMembershipDTO,
  ) {
    const team = await db.getDocument('teams', teamId);
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const membership = await db.getDocument('memberships', memberId);
    if (membership.empty()) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND);
    }

    const user = await db.getDocument(
      'users',
      membership.get('userId'),
    );
    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());
    const isAppUser = Auth.isAppUser(Authorization.getRoles());
    const isOwner = Authorization.isRole(`team:${team.getId()}/owner`);

    if (!isOwner && !isPrivilegedUser && !isAppUser) {
      throw new Exception(
        Exception.USER_UNAUTHORIZED,
        'User is not allowed to modify roles',
      );
    }

    membership.set('roles', input.roles);
    const updatedMembership = await db.updateDocument(
      'memberships',
      membership.getId(),
      membership,
    );

    await db.purgeCachedDocument('users', user.getId());

    updatedMembership
      .set('teamName', team.get('name'))
      .set('userName', user.get('name'))
      .set('userEmail', user.get('email'));

    return updatedMembership;
  }

  /**
   * Update Membership Status
   */
  async updateMemberStatus(
    db: Database,
    teamId: string,
    memberId: string,
    input: UpdateMembershipStatusDTO,
  ) {
    /**@todo ---- */
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }

  /**
   * Delete member of the team
   */
  async deleteMember(db: Database, teamId: string, memberId: string) {
    const team = await db.getDocument('teams', teamId);
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const membership = await db.getDocument('memberships', memberId);
    if (membership.empty()) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND);
    }

    const user = await db.getDocument(
      'users',
      membership.get('userId'),
    );
    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    if (membership.get('teamInternalId') !== team.getSequence()) {
      throw new Exception(Exception.TEAM_MEMBERSHIP_MISMATCH);
    }

    try {
      await db.deleteDocument('memberships', membership.getId());
    } catch (error) {
      if (error instanceof AuthorizationException) {
        throw new Exception(Exception.USER_UNAUTHORIZED);
      }
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove membership from DB',
      );
    }

    await db.purgeCachedDocument('users', user.getId());

    if (membership.get('confirm')) {
      await db.decreaseDocumentAttribute('teams', team.getId(), 'total', 1, 0);
    }

    return null;
  }
}
