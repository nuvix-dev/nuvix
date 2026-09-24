import { Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { MessagingService } from './messaging.service'
import { ProvidersService } from './providers.service'
import { SubscribersService } from './subscribers.service'
import { TopicsService } from './topics.service'

export const messagingRoutes = () =>
  new Elysia({ prefix: '/messaging' })
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))

    // =========================================================================
    // Topics Routes
    // =========================================================================

    .post(
      '/topics',
      {
        body: t.Object({
          topicId: t.Optional(t.String()),
          name: t.String(),
          subscribe: t.Optional(t.Array(t.String())),
        }),
      },
      async ({ db, body }) => {
        const service = new TopicsService(db)
        return service.createTopic(body)
      },
    )

    .get(
      '/topics',
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
        const service = new TopicsService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        if (query?.cursor) queries.push(Query.cursorAfter(query.cursor))
        return service.listTopics(queries, query?.search)
      },
    )

    .get(
      '/topics/:topicId',
      {
        params: t.Object({ topicId: t.String() }),
      },
      async ({ db, params: { topicId } }) => {
        const service = new TopicsService(db)
        return service.getTopic(topicId)
      },
    )

    .patch(
      '/topics/:topicId',
      {
        params: t.Object({ topicId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          subscribe: t.Optional(t.Array(t.String())),
        }),
      },
      async ({ db, params: { topicId }, body }) => {
        const service = new TopicsService(db)
        return service.updateTopic(topicId, body)
      },
    )

    .delete(
      '/topics/:topicId',
      {
        params: t.Object({ topicId: t.String() }),
      },
      async ({ db, params: { topicId } }) => {
        const service = new TopicsService(db)
        await service.deleteTopic(topicId)
        return { status: 'ok' }
      },
    )

    // =========================================================================
    // Subscribers Routes
    // =========================================================================

    .post(
      '/topics/:topicId/subscribers',
      {
        params: t.Object({ topicId: t.String() }),
        body: t.Object({
          subscriberId: t.Optional(t.String()),
          targetId: t.String(),
        }),
      },
      async ({ db, params: { topicId }, body }) => {
        const service = new SubscribersService(db)
        return service.createSubscriber(topicId, body)
      },
    )

    .get(
      '/topics/:topicId/subscribers',
      {
        params: t.Object({ topicId: t.String() }),
        query: t.Optional(
          t.Object({
            search: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
            cursor: t.Optional(t.String()),
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

    .get(
      '/topics/:topicId/subscribers/:subscriberId',
      {
        params: t.Object({ topicId: t.String(), subscriberId: t.String() }),
      },
      async ({ db, params: { topicId, subscriberId } }) => {
        const service = new SubscribersService(db)
        return service.getSubscriber(topicId, subscriberId)
      },
    )

    .delete(
      '/topics/:topicId/subscribers/:subscriberId',
      {
        params: t.Object({ topicId: t.String(), subscriberId: t.String() }),
      },
      async ({ db, params: { topicId, subscriberId } }) => {
        const service = new SubscribersService(db)
        await service.deleteSubscriber(topicId, subscriberId)
        return { status: 'ok' }
      },
    )

    // =========================================================================
    // Providers Routes
    // =========================================================================

    // List providers
    .get(
      '/providers',
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
        const service = new ProvidersService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        if (query?.cursor) queries.push(Query.cursorAfter(query.cursor))
        return service.listProviders(queries, query?.search)
      },
    )

    // Get single provider
    .get(
      '/providers/:providerId',
      {
        params: t.Object({ providerId: t.String() }),
      },
      async ({ db, params: { providerId } }) => {
        const service = new ProvidersService(db)
        return service.getProvider(providerId)
      },
    )

    // Delete provider
    .delete(
      '/providers/:providerId',
      {
        params: t.Object({ providerId: t.String() }),
      },
      async ({ db, params: { providerId } }) => {
        const service = new ProvidersService(db)
        await service.deleteProvider(providerId)
        return { status: 'ok' }
      },
    )

    // Mailgun
    .post(
      '/providers/mailgun',
      {
        body: t.Object({
          providerId: t.Optional(t.String()),
          name: t.String(),
          enabled: t.Optional(t.Boolean()),
          apiKey: t.Optional(t.String()),
          domain: t.Optional(t.String()),
          isEuRegion: t.Optional(t.Boolean()),
          fromName: t.Optional(t.String()),
          fromEmail: t.Optional(t.String()),
          replyToName: t.Optional(t.String()),
          replyToEmail: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createMailgunProvider(body)
      },
    )
    .patch(
      '/providers/mailgun/:providerId',
      {
        params: t.Object({ providerId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          apiKey: t.Optional(t.String()),
          domain: t.Optional(t.String()),
          isEuRegion: t.Optional(t.Boolean()),
          fromName: t.Optional(t.String()),
          fromEmail: t.Optional(t.String()),
          replyToName: t.Optional(t.String()),
          replyToEmail: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateMailgunProvider(providerId, body)
      },
    )

    // SendGrid
    .post(
      '/providers/sendgrid',
      {
        body: t.Object({
          providerId: t.Optional(t.String()),
          name: t.String(),
          enabled: t.Optional(t.Boolean()),
          apiKey: t.Optional(t.String()),
          fromName: t.Optional(t.String()),
          fromEmail: t.Optional(t.String()),
          replyToName: t.Optional(t.String()),
          replyToEmail: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createSendgridProvider(body)
      },
    )
    .patch(
      '/providers/sendgrid/:providerId',
      {
        params: t.Object({ providerId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          apiKey: t.Optional(t.String()),
          fromName: t.Optional(t.String()),
          fromEmail: t.Optional(t.String()),
          replyToName: t.Optional(t.String()),
          replyToEmail: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateSendgridProvider(providerId, body)
      },
    )

    // SMTP
    .post(
      '/providers/smtp',
      {
        body: t.Object({
          providerId: t.Optional(t.String()),
          name: t.String(),
          enabled: t.Optional(t.Boolean()),
          host: t.Optional(t.String()),
          port: t.Optional(t.Number()),
          username: t.Optional(t.String()),
          password: t.Optional(t.String()),
          encryption: t.Optional(t.String()),
          autoTls: t.Optional(t.Boolean()),
          mailer: t.Optional(t.String()),
          fromName: t.Optional(t.String()),
          fromEmail: t.Optional(t.String()),
          replyToName: t.Optional(t.String()),
          replyToEmail: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createSmtpProvider(body)
      },
    )
    .patch(
      '/providers/smtp/:providerId',
      {
        params: t.Object({ providerId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          host: t.Optional(t.String()),
          port: t.Optional(t.Number()),
          username: t.Optional(t.String()),
          password: t.Optional(t.String()),
          encryption: t.Optional(t.String()),
          autoTls: t.Optional(t.Boolean()),
          mailer: t.Optional(t.String()),
          fromName: t.Optional(t.String()),
          fromEmail: t.Optional(t.String()),
          replyToName: t.Optional(t.String()),
          replyToEmail: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateSmtpProvider(providerId, body)
      },
    )

    // Twilio
    .post(
      '/providers/twilio',
      {
        body: t.Object({
          providerId: t.Optional(t.String()),
          name: t.String(),
          enabled: t.Optional(t.Boolean()),
          accountSid: t.Optional(t.String()),
          authToken: t.Optional(t.String()),
          from: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createTwilioProvider(body)
      },
    )
    .patch(
      '/providers/twilio/:providerId',
      {
        params: t.Object({ providerId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          accountSid: t.Optional(t.String()),
          authToken: t.Optional(t.String()),
          from: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateTwilioProvider(providerId, body)
      },
    )

    // Textmagic
    .post(
      '/providers/textmagic',
      {
        body: t.Object({
          providerId: t.Optional(t.String()),
          name: t.String(),
          enabled: t.Optional(t.Boolean()),
          username: t.Optional(t.String()),
          apiKey: t.Optional(t.String()),
          from: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createTextmagicProvider(body)
      },
    )
    .patch(
      '/providers/textmagic/:providerId',
      {
        params: t.Object({ providerId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          username: t.Optional(t.String()),
          apiKey: t.Optional(t.String()),
          from: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateTextmagicProvider(providerId, body)
      },
    )

    // Vonage
    .post(
      '/providers/vonage',
      {
        body: t.Object({
          providerId: t.Optional(t.String()),
          name: t.String(),
          enabled: t.Optional(t.Boolean()),
          apiKey: t.Optional(t.String()),
          apiSecret: t.Optional(t.String()),
          from: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createVonageProvider(body)
      },
    )
    .patch(
      '/providers/vonage/:providerId',
      {
        params: t.Object({ providerId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          apiKey: t.Optional(t.String()),
          apiSecret: t.Optional(t.String()),
          from: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateVonageProvider(providerId, body)
      },
    )

    // Msg91
    .post(
      '/providers/msg91',
      {
        body: t.Object({
          providerId: t.Optional(t.String()),
          name: t.String(),
          enabled: t.Optional(t.Boolean()),
          authKey: t.Optional(t.String()),
          senderId: t.Optional(t.String()),
          templateId: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createMsg91Provider(body)
      },
    )
    .patch(
      '/providers/msg91/:providerId',
      {
        params: t.Object({ providerId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          authKey: t.Optional(t.String()),
          senderId: t.Optional(t.String()),
          templateId: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateMsg91Provider(providerId, body)
      },
    )

    // Telesign
    .post(
      '/providers/telesign',
      {
        body: t.Object({
          providerId: t.Optional(t.String()),
          name: t.String(),
          enabled: t.Optional(t.Boolean()),
          customerId: t.Optional(t.String()),
          apiKey: t.Optional(t.String()),
          from: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createTelesignProvider(body)
      },
    )
    .patch(
      '/providers/telesign/:providerId',
      {
        params: t.Object({ providerId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          customerId: t.Optional(t.String()),
          apiKey: t.Optional(t.String()),
          from: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateTelesignProvider(providerId, body)
      },
    )

    // FCM
    .post(
      '/providers/fcm',
      {
        body: t.Object({
          providerId: t.Optional(t.String()),
          name: t.String(),
          enabled: t.Optional(t.Boolean()),
          serviceAccountJSON: t.Optional(t.Any()),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createFcmProvider(body)
      },
    )
    .patch(
      '/providers/fcm/:providerId',
      {
        params: t.Object({ providerId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          serviceAccountJSON: t.Optional(t.Any()),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateFcmProvider(providerId, body)
      },
    )

    // APNS
    .post(
      '/providers/apns',
      {
        body: t.Object({
          providerId: t.Optional(t.String()),
          name: t.String(),
          enabled: t.Optional(t.Boolean()),
          authKey: t.Optional(t.String()),
          authKeyId: t.Optional(t.String()),
          teamId: t.Optional(t.String()),
          bundleId: t.Optional(t.String()),
          sandbox: t.Optional(t.Boolean()),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createApnsProvider(body)
      },
    )
    .patch(
      '/providers/apns/:providerId',
      {
        params: t.Object({ providerId: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          authKey: t.Optional(t.String()),
          authKeyId: t.Optional(t.String()),
          teamId: t.Optional(t.String()),
          bundleId: t.Optional(t.String()),
          sandbox: t.Optional(t.Boolean()),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateApnsProvider(providerId, body)
      },
    )

    // =========================================================================
    // Messages Routes
    // =========================================================================

    // List messages
    .get(
      '/messages',
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
        const service = new MessagingService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        if (query?.cursor) queries.push(Query.cursorAfter(query.cursor))
        return service.listMessages(queries, query?.search)
      },
    )

    // Get single message
    .get(
      '/messages/:messageId',
      {
        params: t.Object({ messageId: t.String() }),
      },
      async ({ db, params: { messageId } }) => {
        const service = new MessagingService(db)
        return service.getMessage(messageId)
      },
    )

    // Get message targets
    .get(
      '/messages/:messageId/targets',
      {
        params: t.Object({ messageId: t.String() }),
        query: t.Optional(
          t.Object({
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
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

    // Create Email message
    .post(
      '/messages/email',
      {
        body: t.Object({
          messageId: t.Optional(t.String()),
          subject: t.String(),
          content: t.String(),
          topics: t.Optional(t.Array(t.String())),
          users: t.Optional(t.Array(t.String())),
          targets: t.Optional(t.Array(t.String())),
          cc: t.Optional(t.Array(t.String())),
          bcc: t.Optional(t.Array(t.String())),
          attachments: t.Optional(t.Array(t.String())),
          draft: t.Optional(t.Boolean()),
          html: t.Optional(t.Boolean()),
          scheduledAt: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new MessagingService(db)
        return service.createEmailMessage(body)
      },
    )

    // Update Email message
    .patch(
      '/messages/email/:messageId',
      {
        params: t.Object({ messageId: t.String() }),
        body: t.Object({
          subject: t.Optional(t.String()),
          content: t.Optional(t.String()),
          topics: t.Optional(t.Array(t.String())),
          users: t.Optional(t.Array(t.String())),
          targets: t.Optional(t.Array(t.String())),
          cc: t.Optional(t.Array(t.String())),
          bcc: t.Optional(t.Array(t.String())),
          attachments: t.Optional(t.Array(t.String())),
          draft: t.Optional(t.Boolean()),
          html: t.Optional(t.Boolean()),
          scheduledAt: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { messageId }, body }) => {
        const service = new MessagingService(db)
        return service.updateEmailMessage(messageId, body)
      },
    )

    // Create SMS message
    .post(
      '/messages/sms',
      {
        body: t.Object({
          messageId: t.Optional(t.String()),
          content: t.String(),
          topics: t.Optional(t.Array(t.String())),
          users: t.Optional(t.Array(t.String())),
          targets: t.Optional(t.Array(t.String())),
          draft: t.Optional(t.Boolean()),
          scheduledAt: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new MessagingService(db)
        return service.createSmsMessage(body)
      },
    )

    // Update SMS message
    .patch(
      '/messages/sms/:messageId',
      {
        params: t.Object({ messageId: t.String() }),
        body: t.Object({
          content: t.Optional(t.String()),
          topics: t.Optional(t.Array(t.String())),
          users: t.Optional(t.Array(t.String())),
          targets: t.Optional(t.Array(t.String())),
          draft: t.Optional(t.Boolean()),
          scheduledAt: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { messageId }, body }) => {
        const service = new MessagingService(db)
        return service.updateSmsMessage(messageId, body)
      },
    )

    // Create Push message
    .post(
      '/messages/push',
      {
        body: t.Object({
          messageId: t.Optional(t.String()),
          title: t.Optional(t.String()),
          body: t.Optional(t.String()),
          data: t.Optional(t.Any()),
          action: t.Optional(t.String()),
          image: t.Optional(t.String()),
          icon: t.Optional(t.String()),
          sound: t.Optional(t.String()),
          color: t.Optional(t.String()),
          tag: t.Optional(t.String()),
          badge: t.Optional(t.Number()),
          topics: t.Optional(t.Array(t.String())),
          users: t.Optional(t.Array(t.String())),
          targets: t.Optional(t.Array(t.String())),
          draft: t.Optional(t.Boolean()),
          scheduledAt: t.Optional(t.String()),
        }),
      },
      async ({ db, body }) => {
        const service = new MessagingService(db)
        return service.createPushMessage(body)
      },
    )

    // Update Push message
    .patch(
      '/messages/push/:messageId',
      {
        params: t.Object({ messageId: t.String() }),
        body: t.Object({
          title: t.Optional(t.String()),
          body: t.Optional(t.String()),
          data: t.Optional(t.Any()),
          action: t.Optional(t.String()),
          image: t.Optional(t.String()),
          icon: t.Optional(t.String()),
          sound: t.Optional(t.String()),
          color: t.Optional(t.String()),
          tag: t.Optional(t.String()),
          badge: t.Optional(t.Number()),
          topics: t.Optional(t.Array(t.String())),
          users: t.Optional(t.Array(t.String())),
          targets: t.Optional(t.Array(t.String())),
          draft: t.Optional(t.Boolean()),
          scheduledAt: t.Optional(t.String()),
        }),
      },
      async ({ db, params: { messageId }, body }) => {
        const service = new MessagingService(db)
        return service.updatePushMessage(messageId, body)
      },
    )

    // Delete message
    .delete(
      '/messages/:messageId',
      {
        params: t.Object({ messageId: t.String() }),
      },
      async ({ db, params: { messageId } }) => {
        const service = new MessagingService(db)
        await service.deleteMessage(messageId)
        return { status: 'ok' }
      },
    )
