import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CreateTeamDTO,
  UpdateTeamDTO,
  UpdateTeamPrefsDTO,
} from './dto/team.dto';
import { ID } from 'src/core/helper/ID.helper';
import { Exception } from 'src/core/extend/exception';
import { TOTP } from 'src/core/validators/MFA.validator';
import {
  CreateMembershipDTO,
  UpdateMembershipDTO,
  UpdateMembershipStatusDTO,
} from './dto/membership.dto';
import {
  APP_EMAIL_TEAM,
  APP_NAME,
  APP_SMTP_HOST,
  DB_FOR_PROJECT,
  SEND_TYPE_EMAIL,
} from 'src/Utils/constants';
import {
  Authorization,
  AuthorizationException,
  Database,
  Document,
  DuplicateException,
  Permission,
  Query,
  Role,
} from '@nuvix/database';
import { Auth } from 'src/core/helper/auth.helper';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  MailJobs,
  MailQueueOptions,
} from 'src/core/resolvers/queues/mail.queue';
import { LocaleTranslator } from 'src/core/helper/locale.helper';
import { sprintf } from 'sprintf-js';
import * as fs from 'fs';
import * as Template from 'handlebars';

@Injectable()
export class TeamsService {
  private logger: Logger = new Logger(TeamsService.name);

  constructor(
    @Inject(DB_FOR_PROJECT) private readonly db: Database,
    @InjectQueue('mails')
    private readonly mailQueue: Queue<MailQueueOptions, any, MailJobs>,
  ) {}

  /**
   * Find all teams
   */
  async findAll(queries: Query[], search?: string) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    // Get cursor document if there was a cursor query
    const cursor = queries.find((query) =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const teamId = cursor.getValue();
      const cursorDocument = await this.db.getDocument('teams', teamId);

      if (!cursorDocument) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Team '${teamId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    const filterQueries = Query.groupByType(queries)['filters'];
    const results = await this.db.find('teams', queries);
    const total = await this.db.count('teams', filterQueries);

    return {
      teams: results,
      total: total,
    };
  }

  /**
   * Create a new team
   */
  async create(user: Document | null, input: CreateTeamDTO, mode: string) {
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());
    const isAppUser = Auth.isAppUser(Authorization.getRoles());

    const teamId = input.teamId == 'unique()' ? ID.unique() : input.teamId;

    const team = await this.db
      .createDocument(
        'teams',
        new Document({
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
      .catch((error) => {
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
      await this.db.createDocument(
        'memberships',
        new Document({
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
          userInternalId: user.getInternalId(),
          teamId: team.getId(),
          teamInternalId: team.getInternalId(),
          roles: input.roles,
          invited: new Date(),
          joined: new Date(),
          confirm: true,
          secret: '',
          search: [membershipId, user.getId()].join(' '),
        }),
      );

      await this.db.purgeCachedDocument('users', user.getId());
    }

    return team;
  }

  /**
   * Update team
   */
  async update(id: string, input: UpdateTeamDTO) {
    const team = await this.db.getDocument('teams', id);

    if (team.isEmpty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    team.setAttribute('name', input.name);
    team.setAttribute('search', [id, input.name].join(' '));

    const updatedTeam = await this.db.updateDocument(
      'teams',
      team.getId(),
      team,
    );

    return updatedTeam;
  }

  /**
   * Remove team
   */
  async remove(id: string) {
    const team = await this.db.getDocument('teams', id);

    if (team.isEmpty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const deleted = await this.db.deleteDocument('teams', id);
    if (!deleted) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove team from DB',
      );
    }

    // Delete all memberships associated with this team
    const membershipQueries = [Query.equal('teamId', [team.getId()])];
    const memberships = await this.db.find('memberships', membershipQueries);
    for (const membership of memberships) {
      await this.db.deleteDocument('memberships', membership.getId());
    }

    // Additional processing like queueing events could go here
    return null;
  }

  /**
   * Find a team by id
   */
  async findOne(id: string) {
    const team = await this.db.getDocument('teams', id);

    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    return team;
  }

  /**
   * Get team preferences
   */
  async getPrefs(id: string) {
    const team = await this.db.getDocument('teams', id);

    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    return team.getAttribute('prefs', {});
  }

  /**
   * Set team preferences
   */
  async setPrefs(id: string, input: UpdateTeamPrefsDTO) {
    const team = await this.db.getDocument('teams', id);

    if (team.isEmpty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    team.setAttribute('prefs', input.prefs);
    const updatedTeam = await this.db.updateDocument(
      'teams',
      team.getId(),
      team,
    );

    return updatedTeam.getAttribute('prefs');
  }

  /**
   * Add a member to the team
   */
  async addMember(
    id: string,
    input: CreateMembershipDTO,
    project: Document,
    user: Document,
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

    if (!isPrivilegedUser && !isAppUser && !APP_SMTP_HOST) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED);
    }

    const team = await this.db.getDocument('teams', id);
    if (team.isEmpty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    let email = input.email ? input.email.trim().toLowerCase() : '';
    let name = input.name ? input.name.trim() : email;
    let invitee: Document | null = null;

    if (input.userId) {
      invitee = await this.db.getDocument('users', input.userId);
      if (invitee.isEmpty()) {
        throw new Exception(Exception.USER_NOT_FOUND);
      }
      if (email && invitee.getAttribute('email') !== email) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given userId and email do not match',
          409,
        );
      }
      if (input.phone && invitee.getAttribute('phone') !== input.phone) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given userId and phone do not match',
          409,
        );
      }
      email = invitee.getAttribute('email', '');
      input.phone = invitee.getAttribute('phone', '');
      name = !name ? invitee.getAttribute('name', '') : name;
    } else if (input.email) {
      invitee = await this.db.findOne('users', [Query.equal('email', [email])]);
      if (
        !invitee.isEmpty() &&
        input.phone &&
        invitee.getAttribute('phone') !== input.phone
      ) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given email and phone do not match',
          409,
        );
      }
    } else if (input.phone) {
      invitee = await this.db.findOne('users', [
        Query.equal('phone', [input.phone]),
      ]);
      if (
        !invitee.isEmpty() &&
        email &&
        invitee.getAttribute('email') !== email
      ) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given phone and email do not match',
          409,
        );
      }
    }

    if (!invitee || invitee.isEmpty()) {
      const userId = ID.unique();

      // Check user limit if not privileged or app user
      const limit = project.getAttribute('auths', {})['limit'] ?? 0;
      if (!isPrivilegedUser && !isAppUser && limit !== 0) {
        const total = await this.db.count('users', []);
        if (total >= limit) {
          throw new Exception(
            Exception.USER_COUNT_EXCEEDED,
            'Project registration is restricted. Contact your administrator for more information.',
          );
        }
      }

      // Ensure email is not already used in another identity
      const identityWithMatchingEmail = await this.db.findOne('identities', [
        Query.equal('providerEmail', [email]),
      ]);
      if (identityWithMatchingEmail && !identityWithMatchingEmail.isEmpty()) {
        throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS);
      }

      try {
        invitee = await this.db.createDocument(
          'users',
          new Document({
            $id: userId,
            $permissions: [
              Permission.read(Role.any()),
              Permission.read(Role.user(userId)),
              Permission.update(Role.user(userId)),
              Permission.delete(Role.user(userId)),
            ],
            email: email || null,
            phone: input.phone || null,
            emailVerification: false,
            status: true,
            passwordUpdate: null,
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

    let membership = new Document({
      $id: membershipId,
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(invitee.getId())),
        Permission.update(Role.team(team.getId(), 'owner')),
        Permission.delete(Role.user(invitee.getId())),
        Permission.delete(Role.team(team.getId(), 'owner')),
      ],
      userId: invitee.getId(),
      userInternalId: invitee.getInternalId(),
      teamId: team.getId(),
      teamInternalId: team.getInternalId(),
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
          async () => await this.db.createDocument('memberships', membership),
        );
      } catch (error) {
        if (error instanceof DuplicateException) {
          throw new Exception(Exception.TEAM_INVITE_ALREADY_EXISTS);
        }
        throw error;
      }

      await Authorization.skip(
        async () =>
          await this.db.increaseDocumentAttribute(
            'teams',
            team.getId(),
            'total',
            1,
          ),
      );
      await this.db.purgeCachedDocument('users', invitee.getId());
    } else {
      try {
        membership = await this.db.createDocument('memberships', membership);
      } catch (error) {
        if (error instanceof DuplicateException) {
          throw new Exception(Exception.TEAM_INVITE_ALREADY_EXISTS);
        }
        throw error;
      }

      const url = new URL(input.url);
      url.searchParams.append('membershipId', membership.getId());
      url.searchParams.append('userId', invitee.getId());
      url.searchParams.append('secret', secret);
      url.searchParams.append('teamId', team.getId());

      const email = invitee.getAttribute('email');
      if (email) {
        const projectName = project.isEmpty()
          ? 'Console'
          : project.getAttribute('name', '[APP-NAME]');
        let subject = sprintf(
          locale.getText('emails.invitation.subject'),
          team.getAttribute('name'),
          projectName,
        );
        const customTemplate =
          project.getAttribute('templates', {})?.[
            'email.invitation-' + locale.default
          ] ?? {};
        const templatePath =
          __dirname + '/../../assets/locale/templates/email-inner-base.tpl';
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

        const smtp = project.getAttribute('smtp', {});
        const smtpEnabled = smtp['enabled'] ?? false;

        let senderEmail =
          process.env.APP_SYSTEM_EMAIL_ADDRESS || APP_EMAIL_TEAM;
        let senderName =
          process.env.APP_SYSTEM_EMAIL_NAME || APP_NAME + ' Server';
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
          owner: user.getAttribute('name'),
          direction: locale.getText('settings.direction'),
          user: invitee.getAttribute('name'),
          team: team.getAttribute('name'),
          redirect: url.toString(),
          project: projectName,
        };

        await this.mailQueue.add(SEND_TYPE_EMAIL, {
          email,
          subject,
          body,
          server: {
            host: smtp['host'] || null,
            port: smtp['port'] || null,
            username: smtp['username'] || null,
            password: smtp['password'] || null,
            secure: smtp['secure'] ?? false,
            replyTo,
            senderEmail,
            senderName,
          },
          variables: emailVariables,
        });
      }
    }

    membership
      .setAttribute('teamName', team.getAttribute('name'))
      .setAttribute('userName', invitee.getAttribute('name'))
      .setAttribute('userEmail', invitee.getAttribute('email'));

    return membership;
  }

  /**
   * Get all members of the team
   */
  async getMembers(id: string, queries: Query[], search?: string) {
    const team = await this.db.getDocument('teams', id);
    if (team.isEmpty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    if (search) {
      queries.push(Query.search('search', search));
    }

    // Set internal queries
    queries.push(Query.equal('teamInternalId', [team.getInternalId()]));

    // Get cursor document if there was a cursor query
    const cursor = queries.find((query) =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const membershipId = cursor.getValue();
      const cursorDocument = await this.db.getDocument(
        'memberships',
        membershipId,
      );

      if (!cursorDocument) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Membership '${membershipId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    const filterQueries = Query.groupByType(queries)['filters'];
    const memberships = await this.db.find('memberships', queries);
    const total = await this.db.count('memberships', filterQueries);

    const validMemberships = memberships
      .filter((membership) => membership.getAttribute('userId'))
      .map(async (membership) => {
        const user = await this.db.getDocument(
          'users',
          membership.getAttribute('userId'),
        );

        let mfa = user.getAttribute('mfa', false);
        if (mfa) {
          const totp = TOTP.getAuthenticatorFromUser(user);
          const totpEnabled = totp && totp.getAttribute('verified', false);
          const emailEnabled =
            user.getAttribute('email') &&
            user.getAttribute('emailVerification');
          const phoneEnabled =
            user.getAttribute('phone') &&
            user.getAttribute('phoneVerification');

          if (!totpEnabled && !emailEnabled && !phoneEnabled) {
            mfa = false;
          }
        }

        membership
          .setAttribute('mfa', mfa)
          .setAttribute('teamName', team.getAttribute('name'))
          .setAttribute('userName', user.getAttribute('name'))
          .setAttribute('userEmail', user.getAttribute('email'));

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
  async getMember(teamId: string, memberId: string) {
    const team = await this.db.getDocument('teams', teamId);
    if (team.isEmpty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const membership = await this.db.getDocument('memberships', memberId);
    if (membership.isEmpty() || !membership.getAttribute('userId')) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND);
    }

    const user = await this.db.getDocument(
      'users',
      membership.getAttribute('userId'),
    );

    let mfa = user.getAttribute('mfa', false);
    if (mfa) {
      const totp = TOTP.getAuthenticatorFromUser(user);
      const totpEnabled = totp && totp.getAttribute('verified', false);
      const emailEnabled =
        user.getAttribute('email') && user.getAttribute('emailVerification');
      const phoneEnabled =
        user.getAttribute('phone') && user.getAttribute('phoneVerification');

      if (!totpEnabled && !emailEnabled && !phoneEnabled) {
        mfa = false;
      }
    }

    membership
      .setAttribute('mfa', mfa)
      .setAttribute('teamName', team.getAttribute('name'))
      .setAttribute('userName', user.getAttribute('name'))
      .setAttribute('userEmail', user.getAttribute('email'));

    return membership;
  }

  /**
   * Update member of the team
   */
  async updateMember(
    teamId: string,
    memberId: string,
    input: UpdateMembershipDTO,
  ) {
    const team = await this.db.getDocument('teams', teamId);
    if (team.isEmpty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const membership = await this.db.getDocument('memberships', memberId);
    if (membership.isEmpty()) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND);
    }

    const user = await this.db.getDocument(
      'users',
      membership.getAttribute('userId'),
    );
    if (user.isEmpty()) {
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

    membership.setAttribute('roles', input.roles);
    const updatedMembership = await this.db.updateDocument(
      'memberships',
      membership.getId(),
      membership,
    );

    await this.db.purgeCachedDocument('users', user.getId());

    updatedMembership
      .setAttribute('teamName', team.getAttribute('name'))
      .setAttribute('userName', user.getAttribute('name'))
      .setAttribute('userEmail', user.getAttribute('email'));

    return updatedMembership;
  }

  /**
   * Update Membership Status
   */
  async updateMemberStatus(
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
  async deleteMember(teamId: string, memberId: string) {
    const team = await this.db.getDocument('teams', teamId);
    if (team.isEmpty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const membership = await this.db.getDocument('memberships', memberId);
    if (membership.isEmpty()) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND);
    }

    const user = await this.db.getDocument(
      'users',
      membership.getAttribute('userId'),
    );
    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    if (membership.getAttribute('teamInternalId') !== team.getInternalId()) {
      throw new Exception(Exception.TEAM_MEMBERSHIP_MISMATCH);
    }

    try {
      await this.db.deleteDocument('memberships', membership.getId());
    } catch (error) {
      if (error instanceof AuthorizationException) {
        throw new Exception(Exception.USER_UNAUTHORIZED);
      }
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove membership from DB',
      );
    }

    await this.db.purgeCachedDocument('users', user.getId());

    if (membership.getAttribute('confirm')) {
      await this.db.decreaseDocumentAttribute(
        'teams',
        team.getId(),
        'total',
        1,
        0,
      );
    }

    return null;
  }
}
