import { Injectable } from '@nestjs/common'
import { CoreService } from '@nuvix/core'
import { Exception } from '@nuvix/core/extend/exception'
import { Auth, ID } from '@nuvix/core/helpers'
import { DeletesQueue } from '@nuvix/core/resolvers'
import {
  Database,
  Doc,
  DuplicateException,
  Permission,
  Query,
  Role,
} from '@nuvix/db'
import type { UsersDoc } from '@nuvix/utils/types'
import {
  CreateTeamDTO,
  UpdateTeamDTO,
  UpdateTeamPrefsDTO,
} from './DTO/team.dto'

@Injectable()
export class TeamsService {
  constructor(private readonly coreService: CoreService) {}

  /**
   * Find all teams
   */
  async findAll(db: Database, queries: Query[] = [], search?: string) {
    if (search) {
      queries.push(Query.search('search', search))
    }

    const filterQueries = Query.groupByType(queries).filters
    const results = await db.find('teams', queries)
    const total = await db.count('teams', filterQueries)

    return {
      data: results,
      total: total,
    }
  }

  /**
   * Create a new team
   */
  async create(db: Database, user: UsersDoc | null, input: CreateTeamDTO) {
    const teamId = input.teamId === 'unique()' ? ID.unique() : input.teamId

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
          total: Auth.isTrustedActor ? 0 : 1,
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

    if (!Auth.isTrustedActor && user) {
      // Don't add user on server mode
      if (!input.roles?.includes('owner')) {
        input.roles?.push('owner')
      }

      const membershipId = ID.unique()
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
      )

      await db.purgeCachedDocument('users', user.getId())
    }

    return team
  }

  /**
   * Update team
   */
  async update(db: Database, id: string, input: UpdateTeamDTO) {
    const team = await db.getDocument('teams', id)

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    team.set('name', input.name)
    team.set('search', [id, input.name].join(' '))

    const updatedTeam = await db.updateDocument('teams', team.getId(), team)

    return updatedTeam
  }

  /**
   * Remove team
   */
  async remove(db: Database, id: string) {
    const team = await db.getDocument('teams', id)

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    const deleted = await db.deleteDocument('teams', team.getId())
    if (!deleted) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove team from DB',
      )
    }

    const deletes = new DeletesQueue(this.coreService)
    await deletes.deleteMemberships(db, team)

    return
  }

  /**
   * Find a team by id
   */
  async findOne(db: Database, id: string) {
    const team = await db.getDocument('teams', id)

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    return team
  }

  /**
   * Get team preferences
   */
  async getPrefs(db: Database, id: string) {
    const team = await db.getDocument('teams', id)

    if (!team) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    return team.get('prefs', {})
  }

  /**
   * Set team preferences
   */
  async setPrefs(db: Database, id: string, { prefs }: UpdateTeamPrefsDTO) {
    const team = await db.getDocument('teams', id)

    if (team.empty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND)
    }

    team.set('prefs', prefs)
    const updatedTeam = await db.updateDocument('teams', team.getId(), team)

    return updatedTeam.get('prefs')
  }
}
