import { Auth } from '@nuvix/core/auth'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import { BadRequestError, NotFoundError } from '../../shared/errors'
import type { Memberships, MembershipsDoc, TeamsDoc, Users, UsersDoc } from '../../types/generated'
import { formatMembership, type MembershipView } from '../formatter'

export interface CreateMembershipInput {
  userId?: string
  email?: string
  phone?: string
  roles?: string[]
  url?: string
  name?: string
}

export interface UpdateMembershipInput {
  roles: string[]
}

export interface UpdateMembershipStatusInput {
  userId: string
  secret: string
}

export class MembershipsService {
  constructor(private readonly session: Session) {}

  async addMember(teamId: string, input: CreateMembershipInput): Promise<MembershipView> {
    if (!input.userId && !input.email && !input.phone) {
      throw new BadRequestError('At least one of userId, email, or phone is required', {
        code: 'general_argument_invalid',
      })
    }

    const team = (await this.session.getDocument('teams', teamId)) as TeamsDoc
    if (team.empty()) {
      throw new NotFoundError('Team not found', { code: 'team_not_found' })
    }

    let invitee: UsersDoc | null = null
    const email = input.email ? input.email.trim().toLowerCase() : undefined

    if (input.userId) {
      invitee = (await this.session.getDocument('users', input.userId)) as UsersDoc
      if (invitee.empty()) {
        throw new NotFoundError('User not found', { code: 'user_not_found' })
      }
    } else if (email) {
      invitee = (await this.session.findOne('users', [Query.equal('email', [email])])) as UsersDoc
    } else if (input.phone) {
      invitee = (await this.session.findOne('users', [
        Query.equal('phone', [input.phone]),
      ])) as UsersDoc
    }

    if (!invitee || invitee.empty()) {
      const newUserId = ID.unique()
      invitee = (await this.session.createDocument(
        'users',
        new Doc<Users>({
          $id: newUserId,
          $permissions: [
            Permission.read(Role.any()),
            Permission.read(Role.user(newUserId)),
            Permission.update(Role.user(newUserId)),
            Permission.delete(Role.user(newUserId)),
          ],
          email,
          phone: input.phone,
          name: input.name ?? email ?? '',
          emailVerification: false,
          phoneVerification: false,
          status: true,
          hash: Auth.DEFAULT_ALGO,
          hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
          registration: new Date(),
          reset: false,
          mfa: false,
          prefs: {},
          search: [newUserId, email, input.phone, input.name].filter(Boolean).join(' '),
          accessedAt: new Date(),
        }),
      )) as UsersDoc
    }

    const membershipId = ID.unique()
    const secret = Auth.tokenGenerator()
    const roles = input.roles ?? []

    const membershipDoc = new Doc<Memberships>({
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
      roles,
      invited: new Date(),
      joined: null,
      confirm: false,
      secret: Auth.hash(secret),
      search: `${membershipId} ${invitee.getId()}`,
    })

    const created = (await this.session.createDocument(
      'memberships',
      membershipDoc,
    )) as MembershipsDoc
    const view = formatMembership(created)
    view.userName = invitee.get('name') ?? ''
    view.userEmail = invitee.get('email') ?? ''
    view.teamName = team.get('name') ?? ''

    return view
  }

  async getMembers(
    teamId: string,
    queries: Query[] = [],
    search?: string,
  ): Promise<{ total: number; memberships: MembershipView[] }> {
    const team = (await this.session.getDocument('teams', teamId)) as TeamsDoc
    if (team.empty()) {
      throw new NotFoundError('Team not found', { code: 'team_not_found' })
    }

    const q = [...queries, Query.equal('teamId', [teamId])]
    if (search) {
      q.push(Query.search('search', search))
    }
    const filterQueries = Query.groupByType(q).filters

    const docs = (await this.session.find('memberships', q)) as MembershipsDoc[]
    const total = await this.session.count('memberships', filterQueries)

    return {
      total,
      memberships: docs.map(formatMembership),
    }
  }

  async getMember(teamId: string, membershipId: string): Promise<MembershipView> {
    const team = (await this.session.getDocument('teams', teamId)) as TeamsDoc
    if (team.empty()) {
      throw new NotFoundError('Team not found', { code: 'team_not_found' })
    }

    const doc = (await this.session.getDocument('memberships', membershipId)) as MembershipsDoc
    if (doc.empty() || doc.get('teamId') !== teamId) {
      throw new NotFoundError('Membership not found', { code: 'membership_not_found' })
    }

    return formatMembership(doc)
  }

  async updateMember(
    teamId: string,
    membershipId: string,
    input: UpdateMembershipInput,
  ): Promise<MembershipView> {
    const team = (await this.session.getDocument('teams', teamId)) as TeamsDoc
    if (team.empty()) {
      throw new NotFoundError('Team not found', { code: 'team_not_found' })
    }

    const doc = (await this.session.getDocument('memberships', membershipId)) as MembershipsDoc
    if (doc.empty() || doc.get('teamId') !== teamId) {
      throw new NotFoundError('Membership not found', { code: 'membership_not_found' })
    }

    doc.set('roles', input.roles)
    const updated = (await this.session.updateDocument(
      'memberships',
      membershipId,
      doc,
    )) as MembershipsDoc

    return formatMembership(updated)
  }

  async updateMemberStatus(
    teamId: string,
    membershipId: string,
    input: UpdateMembershipStatusInput,
  ): Promise<MembershipView> {
    const doc = (await this.session.getDocument('memberships', membershipId)) as MembershipsDoc
    if (doc.empty() || doc.get('teamId') !== teamId) {
      throw new NotFoundError('Membership not found', { code: 'membership_not_found' })
    }

    const team = (await this.session.getDocument('teams', teamId)) as TeamsDoc
    if (team.empty()) {
      throw new NotFoundError('Team not found', { code: 'team_not_found' })
    }

    if (Auth.hash(input.secret) !== doc.get('secret')) {
      throw new BadRequestError('Invalid secret', { code: 'team_invalid_secret' })
    }

    if (input.userId !== doc.get('userId')) {
      throw new BadRequestError('User mismatch', { code: 'team_invite_mismatch' })
    }

    if (doc.get('confirm') === true) {
      throw new BadRequestError('Membership already confirmed', {
        code: 'membership_already_confirmed',
      })
    }

    doc.set('confirm', true)
    doc.set('joined', new Date())

    const updated = (await this.session.updateDocument(
      'memberships',
      membershipId,
      doc,
    )) as MembershipsDoc

    team.set('total', (team.get('total') ?? 0) + 1)
    await this.session.updateDocument('teams', teamId, team)

    return formatMembership(updated)
  }

  async deleteMember(teamId: string, membershipId: string): Promise<void> {
    const team = (await this.session.getDocument('teams', teamId)) as TeamsDoc
    if (team.empty()) {
      throw new NotFoundError('Team not found', { code: 'team_not_found' })
    }

    const doc = (await this.session.getDocument('memberships', membershipId)) as MembershipsDoc
    if (doc.empty() || doc.get('teamId') !== teamId) {
      throw new NotFoundError('Membership not found', { code: 'membership_not_found' })
    }

    if (doc.get('confirm')) {
      team.set('total', Math.max(0, (team.get('total') ?? 1) - 1))
      await this.session.updateDocument('teams', teamId, team)
    }

    await this.session.deleteDocument('memberships', membershipId)
  }
}
