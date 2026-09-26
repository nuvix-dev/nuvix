import { Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { UserTargetsService } from './service'

export const userTargetsRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))

    // 1. List user targets
    .get(
      '/:userId/targets',
      {
        detail: {
          summary: 'List user targets',
          description:
            'Retrieve a list of communication and messaging delivery targets (email, SMS, push) registered for the user.',
          tags: ['Users Targets'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        query: t.Object({
          limit: t.Optional(
            t.String({
              description: 'Maximum number of targets to return',
              pattern: '^[0-9]+$',
            }),
          ),
          offset: t.Optional(
            t.String({
              description: 'Number of targets to skip before returning results',
              pattern: '^[0-9]+$',
            }),
          ),
        }),
      },
      async ({ db, params: { userId }, query }) => {
        const service = new UserTargetsService(db)
        const queries: Query[] = []
        if (query.limit) queries.push(Query.limit(Number(query.limit)))
        if (query.offset) queries.push(Query.offset(Number(query.offset)))
        return service.findAll(userId, queries)
      },
    )

    // 2. Create user target
    .post(
      '/:userId/targets',
      {
        detail: {
          summary: 'Create user target',
          description:
            'Create a new delivery target (e.g. push device token, SMS phone, email) for the specified user.',
          tags: ['Users Targets'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
        }),
        body: t.Object({
          providerType: t.String({
            description: 'Delivery target provider channel type (email, sms, push)',
          }),
          identifier: t.String({
            description:
              'Destination address or token for the target (e.g. phone number, device token, email)',
          }),
          providerId: t.Optional(
            t.String({
              description: 'Optional messaging provider ID configured in the project',
            }),
          ),
          name: t.Optional(
            t.String({
              description: 'Descriptive human-readable label for the target (e.g. Work Phone)',
            }),
          ),
        }),
      },
      async ({ db, params: { userId }, body }) => {
        const service = new UserTargetsService(db)
        return service.create(userId, body)
      },
    )

    // 3. Get user target by ID
    .get(
      '/:userId/targets/:targetId',
      {
        detail: {
          summary: 'Get user target by ID',
          description:
            'Retrieve details of a specific communication target registered for the user.',
          tags: ['Users Targets'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
          targetId: t.String({ description: 'Unique target identifier' }),
        }),
      },
      async ({ db, params: { userId, targetId } }) => {
        const service = new UserTargetsService(db)
        return service.findOne(userId, targetId)
      },
    )

    // 4. Update user target by ID
    .patch(
      '/:userId/targets/:targetId',
      {
        detail: {
          summary: 'Update user target by ID',
          description:
            'Update configuration or destination attributes of an existing communication target.',
          tags: ['Users Targets'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
          targetId: t.String({ description: 'Unique target identifier' }),
        }),
        body: t.Object({
          identifier: t.Optional(
            t.String({
              description: 'Updated destination identifier or token',
            }),
          ),
          providerId: t.Optional(
            t.String({
              description: 'Updated messaging provider ID',
            }),
          ),
          name: t.Optional(
            t.String({
              description: 'Updated descriptive label for the target',
            }),
          ),
        }),
      },
      async ({ db, params: { userId, targetId }, body }) => {
        const service = new UserTargetsService(db)
        return service.update(userId, targetId, body)
      },
    )

    // 5. Delete user target by ID
    .delete(
      '/:userId/targets/:targetId',
      {
        detail: {
          summary: 'Delete user target by ID',
          description: 'Delete and unregister a communication target for the user.',
          tags: ['Users Targets'],
        },
        params: t.Object({
          userId: t.String({ description: 'Unique user identifier' }),
          targetId: t.String({ description: 'Unique target identifier' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('success', { description: 'Status confirmation string' }),
          }),
        },
      },
      async ({ db, params: { userId, targetId } }) => {
        const service = new UserTargetsService(db)
        return service.delete(userId, targetId)
      },
    )
