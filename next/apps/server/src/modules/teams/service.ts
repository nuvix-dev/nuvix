import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import { ConflictError, NotFoundError, NotImplementedError } from '../../shared/errors'
import type { Memberships, Teams, TeamsDoc, UsersDoc } from '../../types/generated'
import { formatTeam, type TeamView } from './formatter'

export interface CreateTeamInput {
  teamId?: string
  name: string
  roles?: string[]
}

export interface UpdateTeamInput {
  name: string
}

export class TeamsService {
  constructor(private readonly session: Session) {}

  async findAll(
    queries: Query[] = [],
    search?: string,
  ): Promise<{ total: number; teams: TeamView[] }> {
    const q = [...queries]
    if (search) {
      q.push(Query.search('search', search))
    }
    const filterQueries = Query.groupByType(q).filters

    const docs = (await this.session.find('teams', q)) as TeamsDoc[]
    const total = await this.session.count('teams', filterQueries)

    return {
      total,
      teams: docs.map(formatTeam),
    }
  }

  async findOne(teamId: string): Promise<TeamView> {
    const doc = (await this.session.getDocument('teams', teamId)) as TeamsDoc
    if (doc.empty()) {
      throw new NotFoundError('Team not found', { code: 'team_not_found' })
    }
    return formatTeam(doc)
  }

  async create(userId: string | undefined, input: CreateTeamInput): Promise<TeamView> {
    const teamId =
      input.teamId && input.teamId !== 'unique()' ? ID.custom(input.teamId) : ID.unique()

    const existing = (await this.session.getDocument('teams', teamId)) as TeamsDoc
    if (!existing.empty()) {
      throw new ConflictError('Team already exists', { code: 'team_already_exists' })
    }

    const teamDoc = new Doc<Teams>({
      $id: teamId,
      $permissions: [
        Permission.read(Role.team(teamId)),
        Permission.update(Role.team(teamId, 'owner')),
        Permission.delete(Role.team(teamId, 'owner')),
      ],
      name: input.name,
      total: userId ? 1 : 0,
      prefs: {},
      search: `${teamId} ${input.name}`,
    })

    const createdTeam = (await this.session.createDocument('teams', teamDoc)) as TeamsDoc

    if (userId) {
      const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
      const roles = input.roles ? [...new Set(['owner', ...input.roles])] : ['owner']

      const membershipDoc = new Doc<Memberships>({
        $id: ID.unique(),
        $permissions: [
          Permission.read(Role.user(userId)),
          Permission.read(Role.team(teamId)),
          Permission.update(Role.user(userId)),
          Permission.update(Role.team(teamId, 'owner')),
          Permission.delete(Role.user(userId)),
          Permission.delete(Role.team(teamId, 'owner')),
        ],
        userId,
        userInternalId: userDoc.getSequence(),
        teamId,
        teamInternalId: createdTeam.getSequence(),
        roles,
        invited: new Date(),
        joined: new Date(),
        confirm: true,
        secret: '',
        search: `${teamId} ${userId}`,
      })

      await this.session.createDocument('memberships', membershipDoc)
    }

    return formatTeam(createdTeam)
  }

  async update(teamId: string, input: UpdateTeamInput): Promise<TeamView> {
    const doc = (await this.session.getDocument('teams', teamId)) as TeamsDoc
    if (doc.empty()) {
      throw new NotFoundError('Team not found', { code: 'team_not_found' })
    }

    doc.set('name', input.name)
    doc.set('search', `${teamId} ${input.name}`)

    const updated = (await this.session.updateDocument('teams', teamId, doc)) as TeamsDoc
    return formatTeam(updated)
  }

  async remove(teamId: string): Promise<void> {
    const doc = (await this.session.getDocument('teams', teamId)) as TeamsDoc
    if (doc.empty()) {
      throw new NotFoundError('Team not found', { code: 'team_not_found' })
    }

    const memberships = await this.session.find('memberships', [Query.equal('teamId', [teamId])])
    for (const m of memberships) {
      await this.session.deleteDocument('memberships', m.getId())
    }

    await this.session.deleteDocument('teams', teamId)
  }

  async getPrefs(teamId: string): Promise<Record<string, unknown>> {
    const doc = (await this.session.getDocument('teams', teamId)) as TeamsDoc
    if (doc.empty()) {
      throw new NotFoundError('Team not found', { code: 'team_not_found' })
    }
    return (doc.get('prefs') ?? {}) as Record<string, unknown>
  }

  async setPrefs(teamId: string, prefs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const doc = (await this.session.getDocument('teams', teamId)) as TeamsDoc
    if (doc.empty()) {
      throw new NotFoundError('Team not found', { code: 'team_not_found' })
    }

    doc.set('prefs', prefs)
    await this.session.updateDocument('teams', teamId, doc)
    return prefs
  }

  async getLogs(_teamId: string): Promise<never> {
    throw new NotImplementedError('Team logs are not implemented', {
      code: 'general_not_implemented',
    })
  }
}
