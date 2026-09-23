import { Elysia, t } from 'elysia'
import type { CallerAuth } from './operations/teams'
import type { TeamsService } from './service'

export const TeamSchema = t.Object({
  $id: t.String(),
  $permissions: t.Array(t.String()),
  name: t.String(),
  total: t.Number(),
  prefs: t.Record(t.String(), t.Any()),
  $createdAt: t.Optional(t.String()),
  $updatedAt: t.Optional(t.String()),
})

export const MembershipSchema = t.Object({
  $id: t.String(),
  $permissions: t.Array(t.String()),
  userId: t.String(),
  userName: t.String(),
  userEmail: t.String(),
  teamId: t.String(),
  teamName: t.String(),
  roles: t.Array(t.String()),
  status: t.Union([t.Literal('invited'), t.Literal('accepted')]),
  invited: t.String(),
  joined: t.Nullable(t.String()),
  mfa: t.Boolean(),
  confirmUrl: t.Optional(t.String()),
  $createdAt: t.Optional(t.String()),
  $updatedAt: t.Optional(t.String()),
})

export type TeamsServiceResolver =
  | TeamsService
  | ((request: Request) => Promise<TeamsService> | TeamsService)

function getService(
  service: TeamsServiceResolver,
  request: Request,
): Promise<TeamsService> | TeamsService {
  return typeof service === 'function' ? service(request) : service
}

export function teamRoutes(
  service: TeamsServiceResolver,
  getCallerAuth: (request: Request) => CallerAuth = () => ({}),
) {
  return (
    new Elysia({ name: 'team-routes' })
      .post(
        '/teams',
        {
          body: t.Object({
            teamId: t.Optional(t.String()),
            name: t.String({ minLength: 1 }),
            roles: t.Optional(t.Array(t.String())),
          }),
          response: TeamSchema,
          detail: { summary: 'Create team', tags: ['teams'] },
        },
        async ({ body, request }) =>
          (await getService(service, request)).create(body, getCallerAuth(request)),
      )
      .get(
        '/teams',
        {
          query: t.Object({
            limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
            offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
            search: t.Optional(t.String()),
          }),
          response: t.Object({
            data: t.Array(TeamSchema),
            meta: t.Object({
              total: t.Number(),
              limit: t.Number(),
              offset: t.Number(),
            }),
          }),
          detail: { summary: 'List teams', tags: ['teams'] },
        },
        async ({ query, request }) => {
          const limit = query.limit ?? 25
          const offset = query.offset ?? 0
          const svc = await getService(service, request)
          const { teams, total } = await svc.list({
            limit,
            offset,
            search: query.search,
          })
          return {
            data: teams,
            meta: { total, limit, offset },
          }
        },
      )
      .get(
        '/teams/:teamId',
        {
          params: t.Object({ teamId: t.String() }),
          response: TeamSchema,
          detail: { summary: 'Get team', tags: ['teams'] },
        },
        async ({ params: { teamId }, request }) => (await getService(service, request)).get(teamId),
      )
      .put(
        '/teams/:teamId',
        {
          params: t.Object({ teamId: t.String() }),
          body: t.Object({ name: t.String({ minLength: 1 }) }),
          response: TeamSchema,
          detail: { summary: 'Update team name', tags: ['teams'] },
        },
        async ({ params: { teamId }, body, request }) =>
          (await getService(service, request)).update(teamId, body),
      )
      .delete(
        '/teams/:teamId',
        {
          params: t.Object({ teamId: t.String() }),
          response: t.Object({ ok: t.Boolean() }),
          detail: { summary: 'Delete team', tags: ['teams'] },
        },
        async ({ params: { teamId }, request }) => {
          await (await getService(service, request)).delete(teamId)
          return { ok: true }
        },
      )
      .get(
        '/teams/:teamId/prefs',
        {
          params: t.Object({ teamId: t.String() }),
          response: t.Record(t.String(), t.Any()),
          detail: { summary: 'Get team preferences', tags: ['teams'] },
        },
        async ({ params: { teamId }, request }) =>
          (await getService(service, request)).getPrefs(teamId),
      )
      .put(
        '/teams/:teamId/prefs',
        {
          params: t.Object({ teamId: t.String() }),
          body: t.Record(t.String(), t.Any()),
          response: t.Record(t.String(), t.Any()),
          detail: { summary: 'Replace team preferences', tags: ['teams'] },
        },
        async ({ params: { teamId }, body, request }) =>
          (await getService(service, request)).updatePrefs(teamId, body),
      )
      // Membership endpoints
      .post(
        '/teams/:teamId/memberships',
        {
          params: t.Object({ teamId: t.String() }),
          body: t.Object({
            userId: t.Optional(t.String()),
            email: t.Optional(t.String({ format: 'email' })),
            phone: t.Optional(t.String()),
            roles: t.Array(t.String()),
            url: t.Optional(t.String()),
          }),
          response: MembershipSchema,
          detail: { summary: 'Invite team member', tags: ['teams'] },
        },
        async ({ params: { teamId }, body, request }) =>
          (await getService(service, request)).inviteMember(teamId, body, getCallerAuth(request)),
      )
      .get(
        '/teams/:teamId/memberships',
        {
          params: t.Object({ teamId: t.String() }),
          query: t.Object({
            limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
            offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
            search: t.Optional(t.String()),
          }),
          response: t.Object({
            data: t.Array(MembershipSchema),
            meta: t.Object({
              total: t.Number(),
              limit: t.Number(),
              offset: t.Number(),
            }),
          }),
          detail: { summary: 'List team memberships', tags: ['teams'] },
        },
        async ({ params: { teamId }, query, request }) => {
          const limit = query.limit ?? 25
          const offset = query.offset ?? 0
          const svc = await getService(service, request)
          const { memberships, total } = await svc.listMemberships(teamId, {
            limit,
            offset,
            search: query.search,
          })
          return {
            data: memberships,
            meta: { total, limit, offset },
          }
        },
      )
      .get(
        '/teams/:teamId/memberships/:membershipId',
        {
          params: t.Object({ teamId: t.String(), membershipId: t.String() }),
          response: MembershipSchema,
          detail: { summary: 'Get team membership', tags: ['teams'] },
        },
        async ({ params: { teamId, membershipId }, request }) =>
          (await getService(service, request)).getMembership(teamId, membershipId),
      )
      .patch(
        '/teams/:teamId/memberships/:membershipId',
        {
          params: t.Object({ teamId: t.String(), membershipId: t.String() }),
          body: t.Object({ roles: t.Array(t.String()) }),
          response: MembershipSchema,
          detail: { summary: 'Update membership roles', tags: ['teams'] },
        },
        async ({ params: { teamId, membershipId }, body, request }) =>
          (await getService(service, request)).updateMembershipRoles(
            teamId,
            membershipId,
            body.roles,
            getCallerAuth(request),
          ),
      )
      .patch(
        '/teams/:teamId/memberships/:membershipId/status',
        {
          params: t.Object({ teamId: t.String(), membershipId: t.String() }),
          body: t.Object({
            userId: t.String(),
            secret: t.String(),
          }),
          response: MembershipSchema,
          detail: { summary: 'Accept team invite', tags: ['teams'] },
        },
        async ({ params: { teamId, membershipId }, body, request }) =>
          (await getService(service, request)).acceptInvite(teamId, membershipId, body),
      )
      .delete(
        '/teams/:teamId/memberships/:membershipId',
        {
          params: t.Object({ teamId: t.String(), membershipId: t.String() }),
          response: t.Object({ ok: t.Boolean() }),
          detail: { summary: 'Delete team membership', tags: ['teams'] },
        },
        async ({ params: { teamId, membershipId }, request }) => {
          await (await getService(service, request)).deleteMembership(
            teamId,
            membershipId,
            getCallerAuth(request),
          )
          return { ok: true }
        },
      )
  )
}
