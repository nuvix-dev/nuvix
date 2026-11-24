import { Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { MembershipsService } from './service'

export const teamMembershipsRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))

    // 1. Create team membership (invite member)
    .post(
      '/:teamId/memberships',
      {
        detail: {
          summary: 'Create team membership',
          description:
            'Invite a new member to the team by user ID, email address, or phone number, assigning designated roles.',
          tags: ['Teams Memberships'],
        },
        params: t.Object({
          teamId: t.String({ description: 'Unique team identifier' }),
        }),
        body: t.Object({
          userId: t.Optional(
            t.String({
              description: 'Existing user ID to add directly to the team',
            }),
          ),
          email: t.Optional(
            t.String({
              description: 'Email address of the invitee',
              format: 'email',
            }),
          ),
          phone: t.Optional(
            t.String({
              description: 'Phone number of the invitee in E.164 format',
            }),
          ),
          roles: t.Array(
            t.String({
              description: 'Role name within the team (e.g. owner, admin, developer)',
            }),
            {
              description: 'List of role identifiers assigned to the member',
            },
          ),
          url: t.Optional(
            t.String({
              description: 'Redirect URL containing the invite secret for email confirmation',
            }),
          ),
          name: t.Optional(
            t.String({
              description: 'Invitee name if user does not exist yet',
            }),
          ),
        }),
      },
      async ({ db, params: { teamId }, body }) => {
        const service = new MembershipsService(db)
        return service.addMember(teamId, body)
      },
    )

    // 2. List team memberships
    .get(
      '/:teamId/memberships',
      {
        detail: {
          summary: 'List team memberships',
          description: 'Retrieve a paginated list of memberships for the specified team.',
          tags: ['Teams Memberships'],
        },
        params: t.Object({
          teamId: t.String({ description: 'Unique team identifier' }),
        }),
        query: t.Optional(
          t.Object({
            search: t.Optional(
              t.String({
                description: 'Search string to filter members by user or team details',
              }),
            ),
            limit: t.Optional(
              t.String({
                description: 'Maximum number of memberships to return',
                pattern: '^[0-9]+$',
              }),
            ),
            offset: t.Optional(
              t.String({
                description: 'Number of memberships to skip',
                pattern: '^[0-9]+$',
              }),
            ),
          }),
        ),
      },
      async ({ db, params: { teamId }, query }) => {
        const service = new MembershipsService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        return service.getMembers(teamId, queries, query?.search)
      },
    )

    // 3. Get team membership by ID
    .get(
      '/:teamId/memberships/:membershipId',
      {
        detail: {
          summary: 'Get team membership by ID',
          description: 'Retrieve details for a specific membership within a team.',
          tags: ['Teams Memberships'],
        },
        params: t.Object({
          teamId: t.String({ description: 'Unique team identifier' }),
          membershipId: t.String({ description: 'Unique membership identifier' }),
        }),
      },
      async ({ db, params: { teamId, membershipId } }) => {
        const service = new MembershipsService(db)
        return service.getMember(teamId, membershipId)
      },
    )

    // 4. Update team membership roles
    .patch(
      '/:teamId/memberships/:membershipId',
      {
        detail: {
          summary: 'Update team membership roles',
          description: 'Modify the assigned roles for a team member.',
          tags: ['Teams Memberships'],
        },
        params: t.Object({
          teamId: t.String({ description: 'Unique team identifier' }),
          membershipId: t.String({ description: 'Unique membership identifier' }),
        }),
        body: t.Object({
          roles: t.Array(
            t.String({
              description: 'Role name',
            }),
            {
              description: 'Updated complete list of roles for the membership',
            },
          ),
        }),
      },
      async ({ db, params: { teamId, membershipId }, body }) => {
        const service = new MembershipsService(db)
        return service.updateMember(teamId, membershipId, body)
      },
    )

    // 5. Update team membership status (accept invite)
    .patch(
      '/:teamId/memberships/:membershipId/status',
      {
        detail: {
          summary: 'Accept team invite',
          description:
            'Confirm and accept an invitation to join a team using the secret token received.',
          tags: ['Teams Memberships'],
        },
        params: t.Object({
          teamId: t.String({ description: 'Unique team identifier' }),
          membershipId: t.String({ description: 'Unique membership identifier' }),
        }),
        body: t.Object({
          userId: t.String({
            description: 'User ID accepting the invitation',
          }),
          secret: t.String({
            description: 'Secret invite verification token',
          }),
        }),
      },
      async ({ db, params: { teamId, membershipId }, body }) => {
        const service = new MembershipsService(db)
        return service.updateMemberStatus(teamId, membershipId, body)
      },
    )

    // 6. Delete team membership (leave or remove from team)
    .delete(
      '/:teamId/memberships/:membershipId',
      {
        detail: {
          summary: 'Delete team membership',
          description: 'Remove a member from the team or decline/leave a team membership.',
          tags: ['Teams Memberships'],
        },
        params: t.Object({
          teamId: t.String({ description: 'Unique team identifier' }),
          membershipId: t.String({ description: 'Unique membership identifier' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Status confirmation string' }),
          }),
        },
      },
      async ({ db, params: { teamId, membershipId } }) => {
        const service = new MembershipsService(db)
        await service.deleteMember(teamId, membershipId)
        return { status: 'ok' as const }
      },
    )
