import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DataSource, Not, Repository } from 'typeorm';

import { TeamEntity } from 'src/core/entities/users/team.entity';
import { MembershipEntity } from 'src/core/entities/users/membership.entity';
import { UserEntity } from 'src/core/entities/users/user.entity';
import {
  CreateTeamDto,
  UpdateTeamDto,
  UpdateTeamPrefsDto,
} from './dto/team.dto';
import { ID } from 'src/core/helper/ID.helper';
import Permission from 'src/core/helper/permission.helper';
import Role from 'src/core/helper/role.helper';
import { Exception } from 'src/core/extend/exception';
import { TOTP } from 'src/core/validators/MFA.validator';
import {
  UpdateMembershipDto,
  UpdateMembershipStatusDto,
} from './dto/membership.dto';

@Injectable()
export class TeamsService {
  private logger: Logger = new Logger(TeamsService.name);
  private readonly teamRepo: Repository<TeamEntity>;
  private readonly membershipsRepo: Repository<MembershipEntity>;
  private readonly userRepo: Repository<UserEntity>;

  constructor(
    @Inject('CONNECTION') private readonly dataSource: DataSource,
    private readonly cls: ClsService,
  ) {
    this.teamRepo = this.dataSource.getRepository(TeamEntity);
    this.membershipsRepo = this.dataSource.getRepository(MembershipEntity);
    this.userRepo = this.dataSource.getRepository(UserEntity);
  }

  /**
   * Find all teams
   */
  async findAll() {
    const data = await this.teamRepo.findAndCount();
    return {
      total: data[1],
      teams: data[0],
    };
  }

  /**
   * Create a new team
   */
  async create(user: UserEntity | null, input: CreateTeamDto) {
    const teamId = input.teamId == 'unique()' ? ID.unique() : input.teamId;

    const team = this.teamRepo.create({
      $id: teamId,
      $permissions: [
        Permission.Read(Role.Team(teamId)),
        Permission.Update(Role.Team(teamId)),
        Permission.Delete(Role.Team(teamId)),
      ],
      name: input.name,
      total: user ? 1 : 0,
      prefs: {},
      search: [teamId, input.name].join(' '),
    });

    try {
      await this.teamRepo.save(team);
    } catch (error) {
      throw new Exception(Exception.TEAM_ALREADY_EXISTS);
    }

    if (user) {
      if (!input.roles.includes('owner')) {
        input.roles.push('owner');
      }

      const membershipId = ID.unique();
      const membership = this.membershipsRepo.create({
        $id: membershipId,
        $permissions: [
          Permission.Read(Role.User(user.$id)),
          Permission.Read(Role.Team(team.$id)),
          Permission.Update(Role.User(user.$id)),
          Permission.Update(Role.Team(team.$id, 'owner')),
          Permission.Delete(Role.User(user.$id)),
          Permission.Delete(Role.Team(team.$id, 'owner')),
        ],
        userId: user.$id,
        user: user,
        teamId: team.$id,
        team: team,
        roles: input.roles,
        invited: new Date(),
        joined: new Date(),
        confirm: true,
        secret: '',
        search: [membershipId, user.$id].join(' '),
      });

      await this.membershipsRepo.save(membership);
    }

    return team;
  }

  /**
   * Update team
   */
  async update(id: string, input: UpdateTeamDto) {
    const team = await this.teamRepo.findOneBy({ $id: id });
    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    team.name = input.name;
    team.search = [team.$id, input.name].join(' ');

    await this.teamRepo.save(team);

    return team;
  }

  /**
   * Remove team
   */
  async remove(id: string) {
    const team = await this.teamRepo.findOneBy({ $id: id });
    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    await this.teamRepo.remove(team);

    /**@todo handle other actions after Deleting team */

    return null;
  }

  /**
   * Find a team by id
   */
  async findOne(id: string) {
    this.logger.debug(id);
    const team = await this.teamRepo.findOne({ where: { $id: id } });
    this.logger.debug(team);
    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }
    return team;
  }

  /**
   * Get team preferences
   */
  async getPrefs(id: string) {
    const team = await this.teamRepo.findOneBy({ $id: id });
    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }
    return team.prefs;
  }

  /**
   * Set team preferences
   */
  async setPrefs(id: string, input: UpdateTeamPrefsDto) {
    const team = await this.teamRepo.findOneBy({ $id: id });
    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    team.prefs = input.prefs;
    await this.teamRepo.save(team);

    return team.prefs;
  }

  /**
   * Add a member to the team
   */
  async addMember(id: string, input: any) {
    const team = await this.teamRepo.findOneBy({ $id: id });
    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    let invitee: UserEntity | null = null;

    if (input.userId) {
      invitee = await this.userRepo.findOneBy({ $id: input.userId });
      if (!invitee) {
        throw new Exception(Exception.USER_NOT_FOUND);
      }
      if (input.email && invitee.email !== input.email) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          "Given userId and email don't match",
          409,
        );
      }
      if (input.phone && invitee.phone !== input.phone) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          "Given userId and phone don't match",
          409,
        );
      }
    } else if (input.email) {
      invitee = await this.userRepo.findOneBy({ email: input.email });
      if (invitee && input.phone && invitee.phone !== input.phone) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          "Given email and phone don't match",
          409,
        );
      }
    } else if (input.phone) {
      invitee = await this.userRepo.findOneBy({ phone: input.phone });
      if (invitee && input.email && invitee.email !== input.email) {
        throw new Exception(
          Exception.USER_ALREADY_EXISTS,
          "Given phone and email don't match",
          409,
        );
      }
    }

    if (!invitee) {
      invitee = this.userRepo.create({
        $id: ID.unique(),
        email: input.email,
        phone: input.phone,
        name: input.email,
        prefs: {},
        labels: [],
        search: [input.email, input.phone].join(' '),
      });
      await this.userRepo.save(invitee);
    }

    const membershipId = ID.unique();
    const membership = this.membershipsRepo.create({
      $id: membershipId,
      $permissions: [
        Permission.Read(Role.User(invitee.$id)),
        Permission.Read(Role.Team(team.$id)),
        Permission.Update(Role.User(invitee.$id)),
        Permission.Update(Role.Team(team.$id, 'owner')),
        Permission.Delete(Role.User(invitee.$id)),
        Permission.Delete(Role.Team(team.$id, 'owner')),
      ],
      userId: invitee.$id,
      user: invitee,
      teamId: team.$id,
      team: team,
      roles: input.roles,
      invited: new Date(),
      joined: new Date(),
      confirm: true,
      secret: '',
      search: [membershipId, invitee.$id].join(' '),
    });

    await this.membershipsRepo.save(membership);

    team.total += 1;
    await this.teamRepo.save(team);
    // Send invitation email or SMS
    // ...

    return membership;
  }

  /**
   * Get all members of the team
   */
  async getMembers(id: string) {
    const team = await this.teamRepo.findOneBy({ $id: id });
    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const memberships = await this.membershipsRepo.findAndCount({
      where: { teamId: team.$id },
    });

    for (const membership of memberships[0]) {
      const user = await this.userRepo.findOne({
        where: { $id: membership.userId },
        relations: { authenticators: true },
      });

      let mfa = user.mfa || false;
      if (mfa) {
        const totp = TOTP.getAuthenticatorFromUser(user);
        const totpEnabled = totp && totp.verified;
        const emailEnabled = user.email && user.emailVerification;
        const phoneEnabled = user.phone && user.phoneVerification;

        if (!totpEnabled && !emailEnabled && !phoneEnabled) {
          mfa = false;
        }
      }

      membership.mfa = mfa;
      membership.teamName = team.name;
      membership.userName = user.name;
      membership.userEmail = user.email;
    }

    return {
      total: memberships[1],
      memberships: memberships[0],
    };
  }

  /**
   * Get A member of the team
   */
  async getMember(teamId: string, memberId: string) {
    const team = await this.teamRepo.findOneBy({ $id: teamId });
    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const membership = await this.membershipsRepo.findOneBy({
      teamId: team.$id,
      $id: memberId,
    });
    if (!membership) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND);
    }

    const user = await this.userRepo.findOne({
      where: { $id: membership.userId },
      relations: { authenticators: true },
    });

    let mfa = user.mfa || false;
    if (mfa) {
      const totp = TOTP.getAuthenticatorFromUser(user);
      const totpEnabled = totp && totp.verified;
      const emailEnabled = user.email && user.emailVerification;
      const phoneEnabled = user.phone && user.phoneVerification;

      if (!totpEnabled && !emailEnabled && !phoneEnabled) {
        mfa = false;
      }
    }

    membership.mfa = mfa;
    membership.teamName = team.name;
    membership.userName = user.name;
    membership.userEmail = user.email;

    return membership;
  }

  /**
   * Update member of the team
   */
  async updateMember(
    teamId: string,
    memberId: string,
    input: UpdateMembershipDto,
  ) {
    const team = await this.teamRepo.findOneBy({ $id: teamId });
    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const membership = await this.membershipsRepo.findOne({
      where: { teamId: team.$id, $id: memberId },
      relations: { user: true },
    });
    if (!membership) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND);
    }

    if (input.roles) {
      membership.roles = input.roles;
    }

    await this.membershipsRepo.save(membership);

    membership.teamName = team.name;
    membership.userName = membership.user.name;
    membership.userEmail = membership.user.email;

    return membership;
  }

  /**
   * Update Membership Status
   */
  async updateMemberStatus(
    teamId: string,
    memberId: string,
    input: UpdateMembershipStatusDto,
  ) {
    /**@todo ---- */
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }

  /**
   * Delete member of the team
   */
  async deleteMember(teamId: string, memberId: string) {
    const team = await this.teamRepo.findOneBy({ $id: teamId });
    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const membership = await this.membershipsRepo.findOneBy({
      teamId: team.$id,
      $id: memberId,
    });
    if (!membership) {
      throw new Exception(Exception.MEMBERSHIP_NOT_FOUND);
    }

    await this.membershipsRepo.remove(membership);

    team.total -= 1;
    await this.teamRepo.save(team);

    return null;
  }
}
