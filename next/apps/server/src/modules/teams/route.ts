import { type Doc, Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { Users } from '../../types/generated'
import { MembershipsService } from './memberships.service'
import { TeamsService } from './service'

export const teamRoutes = () =>
  new Elysia({ prefix: '/teams' })
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
    }))

    // 1. List teams
    .get(
      '',
      {
        query: t.Optional(
          t.Object({
            search: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
            cursor: t.Optional(t.String()),
          }),
        ),
      },
      async ({ db, query }) => {
        const service = new TeamsService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        if (query?.cursor) queries.push(Query.cursorAfter(query.cursor))
        return service.findAll(queries, query?.search)
      },
    )

    // 2. Create team
    .post(
      '',
      {
        body: t.Object({
          teamId: t.Optional(t.String()),
          name: t.String(),
          roles: t.Optional(t.Array(t.String())),
        }),
      },
      async ({ db, user, body }) => {
        const service = new TeamsService(db)
        const userId = user && !user.empty() ? user.getId() : undefined
        return service.create(userId, body)
      },
    )

    // 3. Get team
    .get(
      '/:teamId',
      {
        params: t.Object({
          teamId: t.String(),
        }),
      },
      async ({ db, params: { teamId } }) => {
        const service = new TeamsService(db)
        return service.findOne(teamId)
      },
    )

    // 4. Update team name
    .put(
      '/:teamId',
      {
        params: t.Object({
          teamId: t.String(),
        }),
        body: t.Object({
          name: t.String(),
        }),
      },
      async ({ db, params: { teamId }, body }) => {
        const service = new TeamsService(db)
        return service.update(teamId, body)
      },
    )

    // 5. Delete team
    .delete(
      '/:teamId',
      {
        params: t.Object({
          teamId: t.String(),
        }),
      },
      async ({ db, params: { teamId } }) => {
        const service = new TeamsService(db)
        await service.remove(teamId)
        return { status: 'ok' }
      },
    )

    // 6. Get team preferences
    .get(
      '/:teamId/prefs',
      {
        params: t.Object({
          teamId: t.String(),
        }),
      },
      async ({ db, params: { teamId } }) => {
        const service = new TeamsService(db)
        return service.getPrefs(teamId)
      },
    )

    // 7. Update team preferences
    .put(
      '/:teamId/prefs',
      {
        params: t.Object({
          teamId: t.String(),
        }),
        body: t.Object({
          prefs: t.Record(t.String(), t.Any()),
        }),
      },
      async ({ db, params: { teamId }, body }) => {
        const service = new TeamsService(db)
        return service.setPrefs(teamId, body.prefs)
      },
    )

    // 8. Create team membership
    .post(
      '/:teamId/memberships',
      {
        params: t.Object({
          teamId: t.String(),
        }),
        body: t.Object({
          userId: t.Optional(t.String()),
          email: t.Optional(t.String()),
          phone: t.Optional(t.String()),
          roles: t.Array(t.String()),
          url: t.Optional(t.String()),
          name: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { teamId }, body }) => {
        const service = new MembershipsService(db)
        return service.addMember(teamId, body)
      },
    )

    // 9. List team memberships
    .get(
      '/:teamId/memberships',
      {
        params: t.Object({
          teamId: t.String(),
        }),
        query: t.Optional(
          t.Object({
            search: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
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

    // 10. Get team membership
    .get(
      '/:teamId/memberships/:membershipId',
      {
        params: t.Object({
          teamId: t.String(),
          membershipId: t.String(),
        }),
      },
      async ({ db, params: { teamId, membershipId } }) => {
        const service = new MembershipsService(db)
        return service.getMember(teamId, membershipId)
      },
    )

    // 11. Update team membership
    .patch(
      '/:teamId/memberships/:membershipId',
      {
        params: t.Object({
          teamId: t.String(),
          membershipId: t.String(),
        }),
        body: t.Object({
          roles: t.Array(t.String()),
        }),
      },
      async ({ db, params: { teamId, membershipId }, body }) => {
        const service = new MembershipsService(db)
        return service.updateMember(teamId, membershipId, body)
      },
    )

    // 12. Update team membership status
    .patch(
      '/:teamId/memberships/:membershipId/status',
      {
        params: t.Object({
          teamId: t.String(),
          membershipId: t.String(),
        }),
        body: t.Object({
          userId: t.String(),
          secret: t.String(),
        }),
      },
      async ({ db, params: { teamId, membershipId }, body }) => {
        const service = new MembershipsService(db)
        return service.updateMemberStatus(teamId, membershipId, body)
      },
    )

    // 13. Delete team membership
    .delete(
      '/:teamId/memberships/:membershipId',
      {
        params: t.Object({
          teamId: t.String(),
          membershipId: t.String(),
        }),
      },
      async ({ db, params: { teamId, membershipId } }) => {
        const service = new MembershipsService(db)
        await service.deleteMember(teamId, membershipId)
        return { status: 'ok' }
      },
    )
