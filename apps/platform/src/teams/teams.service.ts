import { Injectable } from '@nestjs/common'
import {
  Database,
  Doc,
  DuplicateException,
  ID,
  Permission,
  Query,
  Role,
} from '@nuvix/db'
import { Exception } from '@nuvix/core/extend/exception'
import {
  CreateTeamDTO,
  UpdateTeamDTO,
  UpdateTeamPrefsDTO,
} from './DTO/team.dto'
import { CoreService } from '@nuvix/core'
import type { Teams, TeamsDoc, UsersDoc } from '@nuvix/utils/types'

@Injectable()
export class TeamsService {
  private readonly db: Database
  constructor(private readonly coreService: CoreService) {
    this.db = this.coreService.getPlatformDb()
  }

  /**
   * Find all teams
   */
  async findAll(queries: Query[] = [], search?: string) {
    if (search) {
      queries.push(Query.search('search', search))
    }

    const filterQueries = Query.groupByType(queries)['filters']
    const results = (await this.db.find('teams', queries)) as TeamsDoc[]
    const total = await this.db.count('teams', filterQueries)

    return {
      data: results,
      total: total,
    }
  }

  /**
   * Create a new team
   */
  async create(user: UsersDoc, input: CreateTeamDTO) {
    const teamId = input.teamId == 'unique()' ? ID.unique() : input.teamId

    const team = await this.db
      .createDocument(
        'teams',
        new Doc<Teams>({
          $id: teamId,
          $permissions: [
            Permission.read(Role.team(teamId)),
            Permission.update(Role.team(teamId, 'owner')),
            Permission.delete(Role.team(teamId, 'owner')),
          ],
          name: input.name,
          total: 1,
          prefs: {},
          search: [teamId, input.name].join(' '),
        }),
      )
      .catch(error => {
        if (error instanceof DuplicateException) {
          throw new Exception(Exception.TEAM_ALREADY_EXISTS)
        }
        throw error
      })

    const membershipId = ID.unique()
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
    )

    await this.db.purgeCachedDocument('users', user.getId())

    return team
  }

  /**
   * Update team
   */
  async update(id: string, input: UpdateTeamDTO) {
    const team = await this.db.getDocument('teams', id)

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    team.set('name', input.name)
    team.set('search', [id, input.name].join(' '))

    const updatedTeam = await this.db.updateDocument(
      'teams',
      team.getId(),
      team,
    )

    return updatedTeam
  }

  /**
   * Remove team
   */
  async remove(id: string) {
    const team = await this.db.getDocument('teams', id)

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    // TODO: this needs to be improved
    if (team.get('total') > 1) {
      throw new Exception(
        Exception.DELETE_FAILED,
        "Can't delete team with members",
      )
    }

    const deleted = await this.db.deleteDocument('teams', id)
    if (!deleted) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove team from DB',
      )
    }

    // Delete all memberships associated with this team
    const membershipQueries = [Query.equal('teamId', [team.getId()])]
    const memberships = await this.db.find('memberships', membershipQueries)
    for (const membership of memberships) {
      await this.db.deleteDocument('memberships', membership.getId())
    }
  }

  /**
   * Find a team by id
   */
  async findOne(id: string) {
    const team = await this.db.getDocument('teams', id)

    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    return team as TeamsDoc
  }

  /**
   * Get team preferences
   */
  async getPrefs(id: string) {
    const team = await this.db.getDocument('teams', id)

    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    return team.get('prefs', {})
  }

  /**
   * Set team preferences
   */
  async setPrefs(id: string, input: UpdateTeamPrefsDTO) {
    const team = await this.db.getDocument('teams', id)

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    team.set('prefs', input.prefs)
    const updatedTeam = await this.db.updateDocument(
      'teams',
      team.getId(),
      team,
    )

    return updatedTeam.get('prefs')
  }
}
