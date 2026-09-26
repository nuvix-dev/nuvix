import { Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { TopicsService } from './service'

export const messagingTopicsRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))

    // 1. Create topic
    .post(
      '/topics',
      {
        detail: {
          summary: 'Create messaging topic',
          description:
            'Create a new broadcast topic that users or subscribers can subscribe to for targeted messaging.',
          tags: ['Messaging Topics'],
        },
        body: t.Object({
          topicId: t.Optional(
            t.String({
              description: 'Custom unique topic identifier. If omitted, a unique ID is generated.',
            }),
          ),
          name: t.String({
            description: 'Human-readable topic name',
            minLength: 1,
            maxLength: 128,
          }),
          subscribe: t.Optional(
            t.Array(
              t.String({
                description: 'Role or permission string specifying who can subscribe to this topic',
              }),
              {
                description: 'List of allowed subscriber roles',
              },
            ),
          ),
        }),
      },
      async ({ db, body }) => {
        const service = new TopicsService(db)
        return service.createTopic(body)
      },
    )

    // 2. List topics
    .get(
      '/topics',
      {
        detail: {
          summary: 'List messaging topics',
          description:
            'Retrieve a paginated list of messaging topics with optional search and cursor pagination.',
          tags: ['Messaging Topics'],
        },
        query: t.Optional(
          t.Object({
            search: t.Optional(
              t.String({
                description: 'Search string to filter topics by name or ID',
              }),
            ),
            limit: t.Optional(
              t.String({
                description: 'Maximum number of topics to return',
                pattern: '^[0-9]+$',
              }),
            ),
            offset: t.Optional(
              t.String({
                description: 'Number of topics to skip before returning results',
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
        const service = new TopicsService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        if (query?.cursor) queries.push(Query.cursorAfter(query.cursor))
        return service.listTopics(queries, query?.search)
      },
    )

    // 3. Get topic by ID
    .get(
      '/topics/:topicId',
      {
        detail: {
          summary: 'Get messaging topic by ID',
          description: 'Retrieve details and subscriber counts for a specific messaging topic.',
          tags: ['Messaging Topics'],
        },
        params: t.Object({
          topicId: t.String({ description: 'Unique topic identifier' }),
        }),
      },
      async ({ db, params: { topicId } }) => {
        const service = new TopicsService(db)
        return service.getTopic(topicId)
      },
    )

    // 4. Update topic
    .patch(
      '/topics/:topicId',
      {
        detail: {
          summary: 'Update messaging topic',
          description: 'Update the name or subscription permission policies of an existing topic.',
          tags: ['Messaging Topics'],
        },
        params: t.Object({
          topicId: t.String({ description: 'Unique topic identifier' }),
        }),
        body: t.Object({
          name: t.Optional(
            t.String({
              description: 'Updated topic display name',
            }),
          ),
          subscribe: t.Optional(
            t.Array(
              t.String({
                description: 'Role or permission string',
              }),
              {
                description: 'Updated allowed subscriber roles list',
              },
            ),
          ),
        }),
      },
      async ({ db, params: { topicId }, body }) => {
        const service = new TopicsService(db)
        return service.updateTopic(topicId, body)
      },
    )

    // 5. Delete topic
    .delete(
      '/topics/:topicId',
      {
        detail: {
          summary: 'Delete messaging topic',
          description:
            'Permanently delete a messaging topic and remove all associated topic subscriptions.',
          tags: ['Messaging Topics'],
        },
        params: t.Object({
          topicId: t.String({ description: 'Unique topic identifier' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Status confirmation string' }),
          }),
        },
      },
      async ({ db, params: { topicId } }) => {
        const service = new TopicsService(db)
        await service.deleteTopic(topicId)
        return { status: 'ok' as const }
      },
    )
