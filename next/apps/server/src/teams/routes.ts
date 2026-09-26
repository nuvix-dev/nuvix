import { type Doc, Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { Users } from '../types/generated'
import { TeamsService } from './service'

export const teamCoreRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
    }))

    // 1. List teams
    .get(
      '',
      {
        detail: {
          summary: 'List teams',
          description:
            'Retrieve a paginated list of teams in the project with optional search and cursor pagination.',
          tags: ['Teams Core'],
        },
        query: t.Optional(
          t.Object({
            search: t.Optional(
              t.String({
                description: 'Search string to filter teams by name or ID',
              }),
            ),
            limit: t.Optional(
              t.String({
                description: 'Maximum number of teams to return',
                pattern: '^[0-9]+$',
              }),
            ),
            offset: t.Optional(
              t.String({
                description: 'Number of teams to skip before returning results',
                pattern: '^[0-9]+$',
              }),
            ),
            cursor: t.Optional(
              t.String({
                description: 'Pagination cursor token for subsequent page',
              }),
            ),
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
        detail: {
          summary: 'Create team',
          description:
            'Create a new team workspace. The calling user will automatically become the owner.',
          tags: ['Teams Core'],
        },
        body: t.Object({
          teamId: t.Optional(
            t.String({
              description: 'Custom unique team identifier. If omitted, a unique ID is generated.',
            }),
          ),
          name: t.String({
            description: 'Team display name',
            minLength: 1,
            maxLength: 128,
          }),
          roles: t.Optional(
            t.Array(
              t.String({
                description: 'Initial role names for the creator in addition to owner',
              }),
            ),
          ),
        }),
      },
      async ({ db, user, body }) => {
        const service = new TeamsService(db)
        const userId = user && !user.empty() ? user.getId() : undefined
        return service.create(userId, body)
      },
    )

    // 3. Get team by ID
    .get(
      '/:teamId',
      {
        detail: {
          summary: 'Get team by ID',
          description: 'Retrieve details and metadata for a specific team.',
          tags: ['Teams Core'],
        },
        params: t.Object({
          teamId: t.String({ description: 'Unique team identifier' }),
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
        detail: {
          summary: 'Update team name',
          description: 'Update the display name of an existing team.',
          tags: ['Teams Core'],
        },
        params: t.Object({
          teamId: t.String({ description: 'Unique team identifier' }),
        }),
        body: t.Object({
          name: t.String({
            description: 'New display name for the team',
            minLength: 1,
            maxLength: 128,
          }),
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
        detail: {
          summary: 'Delete team',
          description:
            'Permanently delete a team and revoke all associated memberships and permissions.',
          tags: ['Teams Core'],
        },
        params: t.Object({
          teamId: t.String({ description: 'Unique team identifier' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Status confirmation string' }),
          }),
        },
      },
      async ({ db, params: { teamId } }) => {
        const service = new TeamsService(db)
        await service.remove(teamId)
        return { status: 'ok' as const }
      },
    )

    // 6. Get team preferences
    .get(
      '/:teamId/prefs',
      {
        detail: {
          summary: 'Get team preferences',
          description: 'Retrieve custom arbitrary JSON preferences associated with the team.',
          tags: ['Teams Core'],
        },
        params: t.Object({
          teamId: t.String({ description: 'Unique team identifier' }),
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
        detail: {
          summary: 'Update team preferences',
          description: 'Replace custom arbitrary JSON preferences stored for the team.',
          tags: ['Teams Core'],
        },
        params: t.Object({
          teamId: t.String({ description: 'Unique team identifier' }),
        }),
        body: t.Object({
          prefs: t.Record(t.String(), t.Any(), {
            description: 'Custom key-value preference dictionary',
          }),
        }),
      },
      async ({ db, params: { teamId }, body }) => {
        const service = new TeamsService(db)
        return service.setPrefs(teamId, body.prefs)
      },
    )

    // 8. Team logs (reserved)
    .get(
      '/:teamId/logs',
      {
        detail: {
          summary: 'Get team logs',
          description: 'Retrieve audit logs for actions performed within the team context.',
          tags: ['Teams Core'],
        },
        params: t.Object({
          teamId: t.String({ description: 'Unique team identifier' }),
        }),
      },
      async ({ db, params: { teamId } }) => {
        const service = new TeamsService(db)
        return service.getLogs(teamId)
      },
    )
