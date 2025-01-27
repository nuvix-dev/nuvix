import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Authorization,
  AuthorizationException,
  Database,
  Document,
  DuplicateException,
  ID,
  Permission,
  Query,
  Role,
} from '@nuvix/database';
import { Exception } from 'src/core/extend/exception';
import { DB_FOR_CONSOLE } from 'src/Utils/constants';
import {
  CreateMembershipDTO,
  UpdateMembershipDTO,
  UpdateMembershipStatusDTO,
} from './dto/membership.dto';
import { Auth } from 'src/core/helper/auth.helper';
import { TOTP } from 'src/core/validators/MFA.validator';
import { CreateOrgDTO, UpdateOrgDTO, UpdateTeamPrefsDTO } from './dto/team.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger();

  constructor(@Inject(DB_FOR_CONSOLE) private readonly db: Database) {}

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
  async create(user: Document | null, input: CreateOrgDTO) {
    const teamId =
      input.organizationId == 'unique()' ? ID.unique() : input.organizationId;

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
          billingPlan: input.billingPlan,
          paymentMethodId: input.paymentMethodId || null,
          billingAddressId: input.billingAddressId || null,
          total: 1,
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

    const membershipId = ID.unique();
    const membership = await this.db.createDocument(
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
        roles: ['owner'],
        invited: new Date(),
        joined: new Date(),
        confirm: true,
        secret: '',
        search: [membershipId, user.getId()].join(' '),
      }),
    );

    await this.db.purgeCachedDocument('users', user.getId());

    return team;
  }

  /**
   * Update team
   */
  async update(id: string, input: UpdateOrgDTO) {
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

    // TODO: improve the logic || add logic
    if (team.getAttribute('total') > 1) {
      throw new Exception(
        Exception.DELETE_FAILED,
        "Can't delete team with members",
      );
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
  async addMember(id: string, input: CreateMembershipDTO) {
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());
    const isAppUser = Auth.isAppUser(Authorization.getRoles());

    if (!input.userId && !input.email && !input.phone) {
      throw new Exception(
        Exception.GENERAL_ARGUMENT_INVALID,
        'At least one of userId, email, or phone is required',
      );
    }

    const team = await this.db.getDocument('teams', id);
    if (team.isEmpty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    let invitee: Document | null = null;

    if (input.userId) {
      invitee = await this.db.getDocument('users', input.userId);
      if (invitee.isEmpty()) {
        throw new Exception(Exception.USER_NOT_FOUND);
      }
      if (input.email && invitee.getAttribute('email') !== input.email) {
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
    } else if (input.email) {
      invitee = await this.db.findOne('users', [
        Query.equal('email', [input.email]),
      ]);
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
        input.email &&
        invitee.getAttribute('email') !== input.email
      ) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          'Given phone and email do not match',
          409,
        );
      }
    }

    if (invitee.isEmpty()) {
      const userId = ID.unique();
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
          email: input.email || null,
          phone: input.phone || null,
          emailVerification: false,
          name: input.name || input.email,
          prefs: {},
          search: [userId, input.email, input.phone, input.name]
            .filter(Boolean)
            .join(' '),
        }),
      );
    }

    const membershipId = ID.unique();
    const secret = Auth.tokenGenerator();

    const membership = await this.db.createDocument(
      'memberships',
      new Document({
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
      }),
    );

    if (isPrivilegedUser || isAppUser) {
      await this.db.increaseDocumentAttribute(
        'teams',
        team.getId(),
        'total',
        1,
      );
      await this.db.purgeCachedDocument('users', invitee.getId());
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

    if (team.getAttribute('total', 0) === 1) {
      throw new Exception(
        Exception.DELETE_FAILED,
        'Organization must have at least one member',
      );
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

  /**
   * Get Organization Plan
   */
  async billingPlan(id: string) {
    const team = await this.db.getDocument('teams', id);

    if (team.isEmpty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const plan = await this.db.getDocument(
      'plans',
      team.getAttribute('billingPlan') || 'tier-2',
    );

    if (!plan) {
      throw new Exception(Exception.GENERAL_NOT_FOUND, 'Plan not found');
    }

    return plan;
  }
}
