import { Injectable, Logger } from '@nestjs/common';
import {
  Authorization,
  AuthorizationException,
  Database,
  Doc,
  DuplicateException,
  ID,
  Permission,
  Query,
  Role,
} from '@nuvix-tech/db';
import { Exception } from '@nuvix/core/extend/exception';
import {
  CreateMembershipDTO,
  UpdateMembershipDTO,
  UpdateMembershipStatusDTO,
} from './DTO/membership.dto';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { TOTP } from '@nuvix/core/validators/MFA.validator';
import { CreateOrgDTO, UpdateOrgDTO, UpdateTeamPrefsDTO } from './DTO/team.dto';
import { AppConfigService, CoreService } from '@nuvix/core';
import type {
  Organizations,
  OrganizationsDoc,
  UsersDoc,
} from '@nuvix/utils/types';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger();

  private readonly db: Database;
  constructor(
    private readonly coreService: CoreService,
    private readonly appConfig: AppConfigService,
  ) {
    this.db = coreService.getPlatformDb();
  }

  /**
   * Find all teams
   */
  async findAll(queries: Query[], search?: string) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    const filterQueries = Query.groupByType(queries)['filters'];
    const results = (await this.db.find(
      'teams',
      queries,
    )) as OrganizationsDoc[];
    const total = await this.db.count('teams', filterQueries);

    return {
      teams: results,
      total: total,
    };
  }

  /**
   * Create a new team
   */
  async create(user: UsersDoc, input: CreateOrgDTO) {
    const teamId =
      input.organizationId == 'unique()' ? ID.unique() : input.organizationId;

    const team = await this.db
      .createDocument(
        'teams',
        new Doc<Organizations>({
          $id: teamId,
          $permissions: [
            Permission.read(Role.team(teamId)),
            Permission.update(Role.team(teamId, 'owner')),
            Permission.delete(Role.team(teamId, 'owner')),
          ],
          name: input.name,
          billingPlan: input.billingPlan,
          paymentMethodId: input.paymentMethodId,
          billingAddressId: input.billingAddressId,
          total: 1,
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

    const membershipId = ID.unique();
    await this.db.createDocument(
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

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    team.set('name', input.name);
    team.set('search', [id, input.name].join(' '));

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

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    // TODO: improve the logic || add logic
    if (team.get('total') > 1) {
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

    return team as OrganizationsDoc;
  }

  /**
   * Get team preferences
   */
  async getPrefs(id: string) {
    const team = await this.db.getDocument('teams', id);

    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    return team.get('prefs', {});
  }

  /**
   * Set team preferences
   */
  async setPrefs(id: string, input: UpdateTeamPrefsDTO) {
    const team = await this.db.getDocument('teams', id);

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    team.set('prefs', input.prefs);
    const updatedTeam = await this.db.updateDocument(
      'teams',
      team.getId(),
      team,
    );

    return updatedTeam.get('prefs');
  }

  /**
   * Add a member to the team
   */
  async addMember(id: string, input: CreateMembershipDTO) {
    if (!input.userId && !input.email && !input.phone) {
      throw new Exception(
        Exception.GENERAL_ARGUMENT_INVALID,
        'At least one of userId, email, or phone is required',
      );
    }

    const team = await this.db.getDocument('teams', id);
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    let invitee: UsersDoc | null = null;

    if (input.userId) {
      invitee = await this.db.getDocument('users', input.userId);
      if (invitee.empty()) {
        throw new Exception(Exception.USER_NOT_FOUND);
      }
      if (input.email && invitee.get('email') !== input.email) {
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
    } else if (input.email) {
      invitee = await this.db.findOne('users', [
        Query.equal('email', [input.email]),
      ]);
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
      invitee = await this.db.findOne('users', [
        Query.equal('phone', [input.phone]),
      ]);
      if (
        !invitee.empty() &&
        input.email &&
        invitee.get('email') !== input.email
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
          email: input.email,
          phone: input.phone,
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
    const secret = Auth.tokenGenerator(128);

    const membership = await this.db.createDocument(
      'memberships',
      new Doc({
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
        confirm: false,
        secret: Auth.hash(secret),
        search: [membershipId, invitee.getId()].join(' '),
      }),
    );

    membership
      .set('teamName', team.get('name'))
      .set('userName', invitee.get('name'))
      .set('userEmail', invitee.get('email'));

    return membership;
  }

  /**
   * Get all members of the team
   */
  async getMembers(id: string, queries: Query[], search?: string) {
    const team = await this.db.getDocument('teams', id);
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    if (search) {
      queries.push(Query.search('search', search));
    }
    queries.push(Query.equal('teamInternalId', [team.getSequence()]));

    const filterQueries = Query.groupByType(queries)['filters'];
    const memberships = await this.db.find('memberships', queries);
    const total = await this.db.count('memberships', filterQueries);

    const validMemberships = memberships
      .filter(membership => membership.get('userId'))
      .map(async membership => {
        const user = await this.db.getDocument(
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
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const membership = await this.db.getDocument('memberships', memberId);
    if (membership.empty() || !membership.get('userId')) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND);
    }

    const user = await this.db.getDocument('users', membership.get('userId'));

    let mfa = user.get('mfa', false);
    if (mfa) {
      const totp = TOTP.getAuthenticatorFromUser(user);
      const totpEnabled = totp && totp.get('verified', false);
      const emailEnabled = user.get('email') && user.get('emailVerification');
      const phoneEnabled = user.get('phone') && user.get('phoneVerification');

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
    teamId: string,
    memberId: string,
    input: UpdateMembershipDTO,
  ) {
    const team = await this.db.getDocument('teams', teamId);
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const membership = await this.db.getDocument('memberships', memberId);
    if (membership.empty()) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND);
    }

    const user = await this.db.getDocument('users', membership.get('userId'));
    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const isOwner = Authorization.isRole(`team:${team.getId()}/owner`);

    if (!isOwner) {
      throw new Exception(
        Exception.USER_UNAUTHORIZED,
        'User is not allowed to modify roles',
      );
    }

    membership.set('roles', input.roles);
    const updatedMembership = await this.db.updateDocument(
      'memberships',
      membership.getId(),
      membership,
    );

    await this.db.purgeCachedDocument('users', user.getId());

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
    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const membership = await this.db.getDocument('memberships', memberId);
    if (membership.empty()) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND);
    }

    const user = await this.db.getDocument('users', membership.get('userId'));
    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    if (membership.get('teamInternalId') !== team.getSequence()) {
      throw new Exception(Exception.TEAM_MEMBERSHIP_MISMATCH);
    }

    if (team.get('total', 0) === 1) {
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

    if (membership.get('confirm')) {
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

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const plan = await this.db.getDocument(
      'plans',
      team.get('billingPlan') || 'tier-2',
    );

    if (!plan) {
      throw new Exception(Exception.GENERAL_NOT_FOUND, 'Plan not found');
    }

    return plan;
  }
}
