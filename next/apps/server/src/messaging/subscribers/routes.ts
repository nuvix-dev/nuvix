import { Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { SubscribersService } from './service'

export const messagingSubscribersRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))

    // 1. Create subscriber
    .post(
      '/topics/:topicId/subscribers',
      {
        detail: {
          summary: 'Create topic subscriber',
          description:
            'Subscribe a target destination (e.g. push target, email target, phone target) to a specific topic.',
          tags: ['Messaging Subscribers'],
        },
        params: t.Object({
          topicId: t.String({ description: 'Unique topic identifier' }),
        }),
        body: t.Object({
          subscriberId: t.Optional(
            t.String({
              description:
                'Custom unique subscriber identifier. If omitted, a unique ID is generated.',
            }),
          ),
          targetId: t.String({
            description: 'Unique identifier of the target destination to subscribe',
          }),
        }),
      },
      async ({ db, params: { topicId }, body }) => {
        const service = new SubscribersService(db)
        return service.createSubscriber(topicId, body)
      },
    )

    // 2. List topic subscribers
    .get(
      '/topics/:topicId/subscribers',
      {
        detail: {
          summary: 'List topic subscribers',
          description:
            'Retrieve a paginated list of subscribers belonging to a specific topic with optional search and cursor pagination.',
          tags: ['Messaging Subscribers'],
        },
        params: t.Object({
          topicId: t.String({ description: 'Unique topic identifier' }),
        }),
        query: t.Optional(
          t.Object({
            search: t.Optional(
              t.String({
                description: 'Search string to filter subscribers',
              }),
            ),
            limit: t.Optional(
              t.String({
                description: 'Maximum number of subscribers to return',
                pattern: '^[0-9]+$',
              }),
            ),
            offset: t.Optional(
              t.String({
                description: 'Number of subscribers to skip before returning results',
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
      async ({ db, params: { topicId }, query }) => {
        const service = new SubscribersService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        if (query?.cursor) queries.push(Query.cursorAfter(query.cursor))
        return service.listSubscribers(topicId, queries, query?.search)
      },
    )

    // 3. Get topic subscriber by ID
    .get(
      '/topics/:topicId/subscribers/:subscriberId',
      {
        detail: {
          summary: 'Get topic subscriber by ID',
          description: 'Retrieve details for a specific subscriber subscription on a topic.',
          tags: ['Messaging Subscribers'],
        },
        params: t.Object({
          topicId: t.String({ description: 'Unique topic identifier' }),
          subscriberId: t.String({ description: 'Unique subscriber identifier' }),
        }),
      },
      async ({ db, params: { topicId, subscriberId } }) => {
        const service = new SubscribersService(db)
        return service.getSubscriber(topicId, subscriberId)
      },
    )

    // 4. Delete topic subscriber
    .delete(
      '/topics/:topicId/subscribers/:subscriberId',
      {
        detail: {
          summary: 'Delete topic subscriber',
          description: 'Unsubscribe a target destination from a specific topic.',
          tags: ['Messaging Subscribers'],
        },
        params: t.Object({
          topicId: t.String({ description: 'Unique topic identifier' }),
          subscriberId: t.String({ description: 'Unique subscriber identifier' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Status confirmation string' }),
          }),
        },
      },
      async ({ db, params: { topicId, subscriberId } }) => {
        const service = new SubscribersService(db)
        await service.deleteSubscriber(topicId, subscriberId)
        return { status: 'ok' as const }
      },
    )
