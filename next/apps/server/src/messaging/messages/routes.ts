import { Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { MessagingService } from './service'

export const messagingMessagesRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))

    // 1. List messages
    .get(
      '/messages',
      {
        detail: {
          summary: 'List messages',
          description:
            'Retrieve a paginated list of sent, scheduled, or drafted messages with optional search and cursor pagination.',
          tags: ['Messaging Messages'],
        },
        query: t.Optional(
          t.Object({
            search: t.Optional(
              t.String({
                description: 'Search string to filter messages',
              }),
            ),
            limit: t.Optional(
              t.String({
                description: 'Maximum number of messages to return',
                pattern: '^[0-9]+$',
              }),
            ),
            offset: t.Optional(
              t.String({
                description: 'Number of messages to skip before returning results',
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
        const service = new MessagingService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        if (query?.cursor) queries.push(Query.cursorAfter(query.cursor))
        return service.listMessages(queries, query?.search)
      },
    )

    // 2. Get single message
    .get(
      '/messages/:messageId',
      {
        detail: {
          summary: 'Get message by ID',
          description: 'Retrieve details, delivery status, and payload for a specific message.',
          tags: ['Messaging Messages'],
        },
        params: t.Object({
          messageId: t.String({ description: 'Unique message identifier' }),
        }),
      },
      async ({ db, params: { messageId } }) => {
        const service = new MessagingService(db)
        return service.getMessage(messageId)
      },
    )

    // 3. Get message targets
    .get(
      '/messages/:messageId/targets',
      {
        detail: {
          summary: 'List message targets',
          description: 'Retrieve recipient targets associated with a specific message.',
          tags: ['Messaging Messages'],
        },
        params: t.Object({
          messageId: t.String({ description: 'Unique message identifier' }),
        }),
        query: t.Optional(
          t.Object({
            limit: t.Optional(
              t.String({
                description: 'Maximum number of targets to return',
                pattern: '^[0-9]+$',
              }),
            ),
            offset: t.Optional(
              t.String({
                description: 'Number of targets to skip',
                pattern: '^[0-9]+$',
              }),
            ),
          }),
        ),
      },
      async ({ db, params: { messageId }, query }) => {
        const service = new MessagingService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        return service.listTargets(messageId, queries)
      },
    )

    // 4. Create Email message
    .post(
      '/messages/email',
      {
        detail: {
          summary: 'Create Email message',
          description:
            'Compose and schedule or send an outbound Email message to topics, users, or targets.',
          tags: ['Messaging Messages'],
        },
        body: t.Object({
          messageId: t.Optional(t.String({ description: 'Custom unique message identifier' })),
          subject: t.String({ description: 'Email subject line' }),
          content: t.String({ description: 'Email body text or HTML content' }),
          topics: t.Optional(t.Array(t.String(), { description: 'Target topic IDs' })),
          users: t.Optional(t.Array(t.String(), { description: 'Target user IDs' })),
          targets: t.Optional(t.Array(t.String(), { description: 'Explicit delivery target IDs' })),
          cc: t.Optional(t.Array(t.String(), { description: 'Carbon copy email addresses' })),
          bcc: t.Optional(
            t.Array(t.String(), { description: 'Blind carbon copy email addresses' }),
          ),
          attachments: t.Optional(t.Array(t.String(), { description: 'Attachment file IDs' })),
          draft: t.Optional(
            t.Boolean({ description: 'Save as draft without sending immediately' }),
          ),
          html: t.Optional(t.Boolean({ description: 'Whether content is HTML formatted' })),
          scheduledAt: t.Optional(
            t.String({ description: 'ISO 8601 delivery schedule timestamp' }),
          ),
        }),
      },
      async ({ db, body }) => {
        const service = new MessagingService(db)
        return service.createEmailMessage(body)
      },
    )

    // 5. Update Email message
    .patch(
      '/messages/email/:messageId',
      {
        detail: {
          summary: 'Update Email message',
          description:
            'Update content, recipients, or schedule for an unsent or draft Email message.',
          tags: ['Messaging Messages'],
        },
        params: t.Object({ messageId: t.String({ description: 'Unique message identifier' }) }),
        body: t.Object({
          subject: t.Optional(t.String({ description: 'Updated email subject' })),
          content: t.Optional(t.String({ description: 'Updated email content' })),
          topics: t.Optional(t.Array(t.String(), { description: 'Target topic IDs' })),
          users: t.Optional(t.Array(t.String(), { description: 'Target user IDs' })),
          targets: t.Optional(t.Array(t.String(), { description: 'Delivery target IDs' })),
          cc: t.Optional(t.Array(t.String(), { description: 'CC list' })),
          bcc: t.Optional(t.Array(t.String(), { description: 'BCC list' })),
          attachments: t.Optional(t.Array(t.String(), { description: 'Attachment file IDs' })),
          draft: t.Optional(t.Boolean({ description: 'Draft status' })),
          html: t.Optional(t.Boolean({ description: 'HTML format toggle' })),
          scheduledAt: t.Optional(t.String({ description: 'Updated schedule time' })),
        }),
      },
      async ({ db, params: { messageId }, body }) => {
        const service = new MessagingService(db)
        return service.updateEmailMessage(messageId, body)
      },
    )

    // 6. Create SMS message
    .post(
      '/messages/sms',
      {
        detail: {
          summary: 'Create SMS message',
          description: 'Compose and schedule or send an outbound SMS message.',
          tags: ['Messaging Messages'],
        },
        body: t.Object({
          messageId: t.Optional(t.String({ description: 'Custom unique message identifier' })),
          content: t.String({ description: 'Plaintext SMS content body', maxLength: 1600 }),
          topics: t.Optional(t.Array(t.String(), { description: 'Target topic IDs' })),
          users: t.Optional(t.Array(t.String(), { description: 'Target user IDs' })),
          targets: t.Optional(t.Array(t.String(), { description: 'Delivery target IDs' })),
          draft: t.Optional(t.Boolean({ description: 'Save as draft without sending' })),
          scheduledAt: t.Optional(
            t.String({ description: 'ISO 8601 delivery schedule timestamp' }),
          ),
        }),
      },
      async ({ db, body }) => {
        const service = new MessagingService(db)
        return service.createSmsMessage(body)
      },
    )

    // 7. Update SMS message
    .patch(
      '/messages/sms/:messageId',
      {
        detail: {
          summary: 'Update SMS message',
          description: 'Update content, recipients, or schedule for an unsent SMS message.',
          tags: ['Messaging Messages'],
        },
        params: t.Object({ messageId: t.String({ description: 'Unique message identifier' }) }),
        body: t.Object({
          content: t.Optional(t.String({ description: 'Updated SMS text' })),
          topics: t.Optional(t.Array(t.String(), { description: 'Target topic IDs' })),
          users: t.Optional(t.Array(t.String(), { description: 'Target user IDs' })),
          targets: t.Optional(t.Array(t.String(), { description: 'Delivery target IDs' })),
          draft: t.Optional(t.Boolean({ description: 'Draft status' })),
          scheduledAt: t.Optional(t.String({ description: 'Updated schedule time' })),
        }),
      },
      async ({ db, params: { messageId }, body }) => {
        const service = new MessagingService(db)
        return service.updateSmsMessage(messageId, body)
      },
    )

    // 8. Create Push message
    .post(
      '/messages/push',
      {
        detail: {
          summary: 'Create Push notification',
          description:
            'Compose and schedule or send an outbound push notification to mobile or web clients.',
          tags: ['Messaging Messages'],
        },
        body: t.Object({
          messageId: t.Optional(t.String({ description: 'Custom unique message identifier' })),
          title: t.Optional(t.String({ description: 'Notification title' })),
          body: t.Optional(t.String({ description: 'Notification body text' })),
          data: t.Optional(t.Any({ description: 'Custom key-value payload JSON dictionary' })),
          action: t.Optional(t.String({ description: 'Click action URL or intent' })),
          image: t.Optional(t.String({ description: 'Image asset URL' })),
          icon: t.Optional(t.String({ description: 'Notification icon name' })),
          sound: t.Optional(t.String({ description: 'Notification sound asset' })),
          color: t.Optional(t.String({ description: 'Notification accent color' })),
          tag: t.Optional(t.String({ description: 'Notification collapse ID or grouping tag' })),
          badge: t.Optional(t.Number({ description: 'Badge count number' })),
          topics: t.Optional(t.Array(t.String(), { description: 'Target topic IDs' })),
          users: t.Optional(t.Array(t.String(), { description: 'Target user IDs' })),
          targets: t.Optional(t.Array(t.String(), { description: 'Delivery target IDs' })),
          draft: t.Optional(t.Boolean({ description: 'Save as draft without sending' })),
          scheduledAt: t.Optional(
            t.String({ description: 'ISO 8601 delivery schedule timestamp' }),
          ),
        }),
      },
      async ({ db, body }) => {
        const service = new MessagingService(db)
        return service.createPushMessage(body)
      },
    )

    // 9. Update Push message
    .patch(
      '/messages/push/:messageId',
      {
        detail: {
          summary: 'Update Push notification',
          description: 'Update payload or targets for an unsent push notification.',
          tags: ['Messaging Messages'],
        },
        params: t.Object({ messageId: t.String({ description: 'Unique message identifier' }) }),
        body: t.Object({
          title: t.Optional(t.String({ description: 'Updated title' })),
          body: t.Optional(t.String({ description: 'Updated body text' })),
          data: t.Optional(t.Any({ description: 'Updated custom data dictionary' })),
          action: t.Optional(t.String({ description: 'Updated click action' })),
          image: t.Optional(t.String({ description: 'Updated image URL' })),
          icon: t.Optional(t.String({ description: 'Updated icon' })),
          sound: t.Optional(t.String({ description: 'Updated sound' })),
          color: t.Optional(t.String({ description: 'Updated color' })),
          tag: t.Optional(t.String({ description: 'Updated tag' })),
          badge: t.Optional(t.Number({ description: 'Updated badge count' })),
          topics: t.Optional(t.Array(t.String(), { description: 'Target topic IDs' })),
          users: t.Optional(t.Array(t.String(), { description: 'Target user IDs' })),
          targets: t.Optional(t.Array(t.String(), { description: 'Delivery target IDs' })),
          draft: t.Optional(t.Boolean({ description: 'Draft status' })),
          scheduledAt: t.Optional(t.String({ description: 'Updated schedule time' })),
        }),
      },
      async ({ db, params: { messageId }, body }) => {
        const service = new MessagingService(db)
        return service.updatePushMessage(messageId, body)
      },
    )

    // 10. Delete message
    .delete(
      '/messages/:messageId',
      {
        detail: {
          summary: 'Delete message',
          description: 'Permanently delete a message record.',
          tags: ['Messaging Messages'],
        },
        params: t.Object({ messageId: t.String({ description: 'Unique message identifier' }) }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Status confirmation string' }),
          }),
        },
      },
      async ({ db, params: { messageId } }) => {
        const service = new MessagingService(db)
        await service.deleteMessage(messageId)
        return { status: 'ok' as const }
      },
    )
