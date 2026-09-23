import { Elysia, t } from 'elysia'
import { ForbiddenError } from '../../shared/errors'
import type { MessagesService } from './messages.service'
import type { ProvidersService } from './providers.service'
import type { SubscribersService } from './subscribers.service'
import type { TopicsService } from './topics.service'
import type { MessagingCallerAuth } from './types'

// ---------- Shared TypeBox schemas ----------

export const ProviderObjectSchema = t.Object({
  $id: t.String(),
  name: t.String(),
  provider: t.String(),
  type: t.String(),
  enabled: t.Boolean(),
  options: t.Record(t.String(), t.Unknown()),
  $createdAt: t.String(),
  $updatedAt: t.String(),
})

export const TopicObjectSchema = t.Object({
  $id: t.String(),
  name: t.String(),
  subscribe: t.Array(t.String()),
  emailTotal: t.Number(),
  smsTotal: t.Number(),
  pushTotal: t.Number(),
  $createdAt: t.String(),
  $updatedAt: t.String(),
})

export const SubscriberObjectSchema = t.Object({
  $id: t.String(),
  topicId: t.String(),
  targetId: t.String(),
  userId: t.String(),
  providerType: t.String(),
  userName: t.Optional(t.String()),
  target: t.Optional(
    t.Object({
      $id: t.String(),
      providerType: t.String(),
      identifier: t.String(),
    }),
  ),
  $createdAt: t.String(),
  $updatedAt: t.String(),
})

export const MessageObjectSchema = t.Object({
  $id: t.String(),
  providerType: t.String(),
  status: t.String(),
  topics: t.Array(t.String()),
  users: t.Array(t.String()),
  targets: t.Array(t.String()),
  data: t.Record(t.String(), t.Unknown()),
  scheduledAt: t.Nullable(t.String()),
  deliveredAt: t.Nullable(t.String()),
  deliveryErrors: t.Array(t.String()),
  deliveredTotal: t.Number(),
  $createdAt: t.String(),
  $updatedAt: t.String(),
})

const ListMeta = t.Object({
  total: t.Number(),
  limit: t.Number(),
  offset: t.Number(),
})

const PaginationQuery = t.Object({
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
  offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
})

// ---------- Auth helper ----------

function requireAdmin(caller: MessagingCallerAuth, msg = 'Admin access required'): void {
  if (!caller.isAdmin && !caller.isKey) {
    throw new ForbiddenError(msg, { code: 'general_access_forbidden' })
  }
}

// ---------- Service resolver types ----------

type Resolve<T> = T | ((req: Request) => T | Promise<T>)

async function resolve<T>(r: Resolve<T>, req: Request): Promise<T> {
  return typeof r === 'function' ? (r as (req: Request) => T | Promise<T>)(req) : r
}

// ---------- Route factories ----------

type ProvidersServiceResolver = Resolve<ProvidersService>
type TopicsServiceResolver = Resolve<TopicsService>
type SubscribersServiceResolver = Resolve<SubscribersService>
type MessagesServiceResolver = Resolve<MessagesService>
type CallerAuthResolver = (req: Request) => MessagingCallerAuth

function providersRoutes(svcR: ProvidersServiceResolver, getAuth: CallerAuthResolver) {
  return (
    new Elysia({ name: 'messaging-providers' })
      .get(
        '/messaging/providers',
        {
          query: t.Object({
            ...PaginationQuery.properties,
            type: t.Optional(t.String()),
          }),
          response: t.Object({ data: t.Array(ProviderObjectSchema), meta: ListMeta }),
        },
        async ({ request, query }) => {
          requireAdmin(getAuth(request))
          const svc = await resolve(svcR, request)
          const { providers, total } = await svc.listProviders({
            limit: query.limit ?? 25,
            offset: query.offset ?? 0,
            type: query.type,
          })
          return {
            data: providers,
            meta: { total, limit: query.limit ?? 25, offset: query.offset ?? 0 },
          }
        },
      )
      .get(
        '/messaging/providers/:providerId',
        { response: ProviderObjectSchema },
        async ({ request, params }) => {
          requireAdmin(getAuth(request))
          const svc = await resolve(svcR, request)
          return svc.getProvider(params.providerId)
        },
      )
      // Email
      .post(
        '/messaging/providers/mailgun',
        {
          body: t.Object({
            providerId: t.Optional(t.String()),
            name: t.String({ minLength: 1 }),
            enabled: t.Optional(t.Boolean()),
            apiKey: t.String({ minLength: 1 }),
            domain: t.String({ minLength: 1 }),
            isEuRegion: t.Optional(t.Boolean()),
            fromName: t.Optional(t.String()),
            fromEmail: t.Optional(t.String()),
            replyToName: t.Optional(t.String()),
            replyToEmail: t.Optional(t.String()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).createMailgun(body)
        },
      )
      .patch(
        '/messaging/providers/mailgun/:providerId',
        {
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
          response: ProviderObjectSchema,
        },
        async ({ request, params, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).updateMailgun(params.providerId, body)
        },
      )
      .post(
        '/messaging/providers/sendgrid',
        {
          body: t.Object({
            providerId: t.Optional(t.String()),
            name: t.String({ minLength: 1 }),
            enabled: t.Optional(t.Boolean()),
            apiKey: t.String({ minLength: 1 }),
            fromName: t.Optional(t.String()),
            fromEmail: t.Optional(t.String()),
            replyToName: t.Optional(t.String()),
            replyToEmail: t.Optional(t.String()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).createSendgrid(body)
        },
      )
      .patch(
        '/messaging/providers/sendgrid/:providerId',
        {
          body: t.Object({
            name: t.Optional(t.String()),
            enabled: t.Optional(t.Boolean()),
            apiKey: t.Optional(t.String()),
            fromName: t.Optional(t.String()),
            fromEmail: t.Optional(t.String()),
            replyToName: t.Optional(t.String()),
            replyToEmail: t.Optional(t.String()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, params, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).updateSendgrid(params.providerId, body)
        },
      )
      .post(
        '/messaging/providers/smtp',
        {
          body: t.Object({
            providerId: t.Optional(t.String()),
            name: t.String({ minLength: 1 }),
            enabled: t.Optional(t.Boolean()),
            host: t.String({ minLength: 1 }),
            port: t.Optional(t.Integer()),
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
          response: ProviderObjectSchema,
        },
        async ({ request, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).createSmtp(body)
        },
      )
      .patch(
        '/messaging/providers/smtp/:providerId',
        {
          body: t.Object({
            name: t.Optional(t.String()),
            enabled: t.Optional(t.Boolean()),
            host: t.Optional(t.String()),
            port: t.Optional(t.Integer()),
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
          response: ProviderObjectSchema,
        },
        async ({ request, params, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).updateSmtp(params.providerId, body)
        },
      )
      // SMS
      .post(
        '/messaging/providers/twilio',
        {
          body: t.Object({
            providerId: t.Optional(t.String()),
            name: t.String({ minLength: 1 }),
            enabled: t.Optional(t.Boolean()),
            accountSid: t.String({ minLength: 1 }),
            authToken: t.String({ minLength: 1 }),
            from: t.String({ minLength: 1 }),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).createTwilio(body)
        },
      )
      .patch(
        '/messaging/providers/twilio/:providerId',
        {
          body: t.Object({
            name: t.Optional(t.String()),
            enabled: t.Optional(t.Boolean()),
            accountSid: t.Optional(t.String()),
            authToken: t.Optional(t.String()),
            from: t.Optional(t.String()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, params, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).updateTwilio(params.providerId, body)
        },
      )
      .post(
        '/messaging/providers/vonage',
        {
          body: t.Object({
            providerId: t.Optional(t.String()),
            name: t.String({ minLength: 1 }),
            enabled: t.Optional(t.Boolean()),
            apiKey: t.String({ minLength: 1 }),
            apiSecret: t.String({ minLength: 1 }),
            from: t.String({ minLength: 1 }),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).createVonage(body)
        },
      )
      .patch(
        '/messaging/providers/vonage/:providerId',
        {
          body: t.Object({
            name: t.Optional(t.String()),
            enabled: t.Optional(t.Boolean()),
            apiKey: t.Optional(t.String()),
            apiSecret: t.Optional(t.String()),
            from: t.Optional(t.String()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, params, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).updateVonage(params.providerId, body)
        },
      )
      .post(
        '/messaging/providers/msg91',
        {
          body: t.Object({
            providerId: t.Optional(t.String()),
            name: t.String({ minLength: 1 }),
            enabled: t.Optional(t.Boolean()),
            authKey: t.String({ minLength: 1 }),
            senderId: t.String({ minLength: 1 }),
            templateId: t.Optional(t.String()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).createMsg91(body)
        },
      )
      .patch(
        '/messaging/providers/msg91/:providerId',
        {
          body: t.Object({
            name: t.Optional(t.String()),
            enabled: t.Optional(t.Boolean()),
            authKey: t.Optional(t.String()),
            senderId: t.Optional(t.String()),
            templateId: t.Optional(t.String()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, params, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).updateMsg91(params.providerId, body)
        },
      )
      .post(
        '/messaging/providers/telesign',
        {
          body: t.Object({
            providerId: t.Optional(t.String()),
            name: t.String({ minLength: 1 }),
            enabled: t.Optional(t.Boolean()),
            customerId: t.String({ minLength: 1 }),
            apiKey: t.String({ minLength: 1 }),
            from: t.Optional(t.String()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).createTelesign(body)
        },
      )
      .patch(
        '/messaging/providers/telesign/:providerId',
        {
          body: t.Object({
            name: t.Optional(t.String()),
            enabled: t.Optional(t.Boolean()),
            customerId: t.Optional(t.String()),
            apiKey: t.Optional(t.String()),
            from: t.Optional(t.String()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, params, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).updateTelesign(params.providerId, body)
        },
      )
      .post(
        '/messaging/providers/textmagic',
        {
          body: t.Object({
            providerId: t.Optional(t.String()),
            name: t.String({ minLength: 1 }),
            enabled: t.Optional(t.Boolean()),
            username: t.String({ minLength: 1 }),
            apiKey: t.String({ minLength: 1 }),
            from: t.Optional(t.String()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).createTextmagic(body)
        },
      )
      .patch(
        '/messaging/providers/textmagic/:providerId',
        {
          body: t.Object({
            name: t.Optional(t.String()),
            enabled: t.Optional(t.Boolean()),
            username: t.Optional(t.String()),
            apiKey: t.Optional(t.String()),
            from: t.Optional(t.String()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, params, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).updateTextmagic(params.providerId, body)
        },
      )
      // Push
      .post(
        '/messaging/providers/fcm',
        {
          body: t.Object({
            providerId: t.Optional(t.String()),
            name: t.String({ minLength: 1 }),
            enabled: t.Optional(t.Boolean()),
            serviceAccount: t.String({ minLength: 1 }),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).createFcm(body)
        },
      )
      .patch(
        '/messaging/providers/fcm/:providerId',
        {
          body: t.Object({
            name: t.Optional(t.String()),
            enabled: t.Optional(t.Boolean()),
            serviceAccount: t.Optional(t.String()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, params, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).updateFcm(params.providerId, body)
        },
      )
      .post(
        '/messaging/providers/apns',
        {
          body: t.Object({
            providerId: t.Optional(t.String()),
            name: t.String({ minLength: 1 }),
            enabled: t.Optional(t.Boolean()),
            authKey: t.String({ minLength: 1 }),
            keyId: t.String({ minLength: 1 }),
            teamId: t.String({ minLength: 1 }),
            bundleId: t.String({ minLength: 1 }),
            sandbox: t.Optional(t.Boolean()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).createApns(body)
        },
      )
      .patch(
        '/messaging/providers/apns/:providerId',
        {
          body: t.Object({
            name: t.Optional(t.String()),
            enabled: t.Optional(t.Boolean()),
            authKey: t.Optional(t.String()),
            keyId: t.Optional(t.String()),
            teamId: t.Optional(t.String()),
            bundleId: t.Optional(t.String()),
            sandbox: t.Optional(t.Boolean()),
          }),
          response: ProviderObjectSchema,
        },
        async ({ request, params, body }) => {
          requireAdmin(getAuth(request))
          return (await resolve(svcR, request)).updateApns(params.providerId, body)
        },
      )
      .delete(
        '/messaging/providers/:providerId',
        { response: t.Object({ ok: t.Boolean() }) },
        async ({ request, params, set }) => {
          requireAdmin(getAuth(request))
          await (await resolve(svcR, request)).deleteProvider(params.providerId)
          set.status = 204
          return { ok: true }
        },
      )
  )
}

function topicsRoutes(svcR: TopicsServiceResolver, getAuth: CallerAuthResolver) {
  return new Elysia({ name: 'messaging-topics' })
    .get(
      '/messaging/topics',
      {
        query: t.Object({
          ...PaginationQuery.properties,
          search: t.Optional(t.String()),
        }),
        response: t.Object({ data: t.Array(TopicObjectSchema), meta: ListMeta }),
      },
      async ({ request, query }) => {
        requireAdmin(getAuth(request))
        const svc = await resolve(svcR, request)
        const { topics, total } = await svc.listTopics({
          limit: query.limit ?? 25,
          offset: query.offset ?? 0,
          search: query.search,
        })
        return {
          data: topics,
          meta: { total, limit: query.limit ?? 25, offset: query.offset ?? 0 },
        }
      },
    )
    .post(
      '/messaging/topics',
      {
        body: t.Object({
          topicId: t.Optional(t.String()),
          name: t.String({ minLength: 1 }),
          subscribe: t.Optional(t.Array(t.String())),
        }),
        response: TopicObjectSchema,
      },
      async ({ request, body }) => {
        requireAdmin(getAuth(request))
        return (await resolve(svcR, request)).createTopic(body)
      },
    )
    .get(
      '/messaging/topics/:topicId',
      { response: TopicObjectSchema },
      async ({ request, params }) => {
        requireAdmin(getAuth(request))
        return (await resolve(svcR, request)).getTopic(params.topicId)
      },
    )
    .patch(
      '/messaging/topics/:topicId',
      {
        body: t.Object({
          name: t.Optional(t.String()),
          subscribe: t.Optional(t.Array(t.String())),
        }),
        response: TopicObjectSchema,
      },
      async ({ request, params, body }) => {
        requireAdmin(getAuth(request))
        return (await resolve(svcR, request)).updateTopic(params.topicId, body)
      },
    )
    .delete(
      '/messaging/topics/:topicId',
      { response: t.Object({ ok: t.Boolean() }) },
      async ({ request, params, set }) => {
        requireAdmin(getAuth(request))
        await (await resolve(svcR, request)).deleteTopic(params.topicId)
        set.status = 204
        return { ok: true }
      },
    )
}

function subscribersRoutes(svcR: SubscribersServiceResolver, getAuth: CallerAuthResolver) {
  return new Elysia({ name: 'messaging-subscribers' })
    .post(
      '/messaging/topics/:topicId/subscribers',
      {
        body: t.Object({
          subscriberId: t.Optional(t.String()),
          targetId: t.String({ minLength: 1 }),
        }),
        response: SubscriberObjectSchema,
      },
      async ({ request, params, body }) => {
        const caller = getAuth(request)
        return (await resolve(svcR, request)).createSubscriber(params.topicId, body, caller)
      },
    )
    .get(
      '/messaging/topics/:topicId/subscribers',
      {
        query: PaginationQuery,
        response: t.Object({ data: t.Array(SubscriberObjectSchema), meta: ListMeta }),
      },
      async ({ request, params, query }) => {
        requireAdmin(getAuth(request))
        const svc = await resolve(svcR, request)
        const { subscribers, total } = await svc.listSubscribers(params.topicId, {
          limit: query.limit ?? 25,
          offset: query.offset ?? 0,
        })
        return {
          data: subscribers,
          meta: { total, limit: query.limit ?? 25, offset: query.offset ?? 0 },
        }
      },
    )
    .get(
      '/messaging/topics/:topicId/subscribers/:subscriberId',
      { response: SubscriberObjectSchema },
      async ({ request, params }) => {
        requireAdmin(getAuth(request))
        return (await resolve(svcR, request)).getSubscriber(params.topicId, params.subscriberId)
      },
    )
    .delete(
      '/messaging/topics/:topicId/subscribers/:subscriberId',
      { response: t.Object({ ok: t.Boolean() }) },
      async ({ request, params, set }) => {
        const caller = getAuth(request)
        await (await resolve(svcR, request)).deleteSubscriber(
          params.topicId,
          params.subscriberId,
          caller,
        )
        set.status = 204
        return { ok: true }
      },
    )
}

function messagesRoutes(svcR: MessagesServiceResolver, getAuth: CallerAuthResolver) {
  return new Elysia({ name: 'messaging-messages' })
    .get(
      '/messaging/messages',
      {
        query: PaginationQuery,
        response: t.Object({ data: t.Array(MessageObjectSchema), meta: ListMeta }),
      },
      async ({ request, query }) => {
        requireAdmin(getAuth(request))
        const svc = await resolve(svcR, request)
        const { messages, total } = await svc.listMessages({
          limit: query.limit ?? 25,
          offset: query.offset ?? 0,
        })
        return {
          data: messages,
          meta: { total, limit: query.limit ?? 25, offset: query.offset ?? 0 },
        }
      },
    )
    .get(
      '/messaging/messages/:messageId',
      { response: MessageObjectSchema },
      async ({ request, params }) => {
        requireAdmin(getAuth(request))
        return (await resolve(svcR, request)).getMessage(params.messageId)
      },
    )
    .post(
      '/messaging/messages/email',
      {
        body: t.Object({
          messageId: t.Optional(t.String()),
          subject: t.String({ minLength: 1 }),
          content: t.String({ minLength: 1 }),
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
        response: MessageObjectSchema,
      },
      async ({ request, body }) => {
        requireAdmin(getAuth(request))
        return (await resolve(svcR, request)).createEmail(body)
      },
    )
    .post(
      '/messaging/messages/sms',
      {
        body: t.Object({
          messageId: t.Optional(t.String()),
          content: t.String({ minLength: 1 }),
          topics: t.Optional(t.Array(t.String())),
          users: t.Optional(t.Array(t.String())),
          targets: t.Optional(t.Array(t.String())),
          draft: t.Optional(t.Boolean()),
          scheduledAt: t.Optional(t.String()),
        }),
        response: MessageObjectSchema,
      },
      async ({ request, body }) => {
        requireAdmin(getAuth(request))
        return (await resolve(svcR, request)).createSms(body)
      },
    )
    .post(
      '/messaging/messages/push',
      {
        body: t.Object({
          messageId: t.Optional(t.String()),
          title: t.String({ minLength: 1 }),
          pushBody: t.String({ minLength: 1 }),
          topics: t.Optional(t.Array(t.String())),
          users: t.Optional(t.Array(t.String())),
          targets: t.Optional(t.Array(t.String())),
          data: t.Optional(t.Record(t.String(), t.Unknown())),
          action: t.Optional(t.String()),
          icon: t.Optional(t.String()),
          badge: t.Optional(t.Integer()),
          tag: t.Optional(t.String()),
          color: t.Optional(t.String()),
          sound: t.Optional(t.String()),
          critical: t.Optional(t.Boolean()),
          draft: t.Optional(t.Boolean()),
          scheduledAt: t.Optional(t.String()),
        }),
        response: MessageObjectSchema,
      },
      async ({ request, body }) => {
        requireAdmin(getAuth(request))
        return (await resolve(svcR, request)).createPush({ ...body, body: body.pushBody })
      },
    )
    .patch(
      '/messaging/messages/email/:messageId',
      {
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
        response: MessageObjectSchema,
      },
      async ({ request, params, body }) => {
        requireAdmin(getAuth(request))
        return (await resolve(svcR, request)).updateEmail(params.messageId, body)
      },
    )
    .patch(
      '/messaging/messages/sms/:messageId',
      {
        body: t.Object({
          content: t.Optional(t.String()),
          topics: t.Optional(t.Array(t.String())),
          users: t.Optional(t.Array(t.String())),
          targets: t.Optional(t.Array(t.String())),
          draft: t.Optional(t.Boolean()),
          scheduledAt: t.Optional(t.String()),
        }),
        response: MessageObjectSchema,
      },
      async ({ request, params, body }) => {
        requireAdmin(getAuth(request))
        return (await resolve(svcR, request)).updateSms(params.messageId, body)
      },
    )
    .patch(
      '/messaging/messages/push/:messageId',
      {
        body: t.Object({
          title: t.Optional(t.String()),
          pushBody: t.Optional(t.String()),
          topics: t.Optional(t.Array(t.String())),
          users: t.Optional(t.Array(t.String())),
          targets: t.Optional(t.Array(t.String())),
          data: t.Optional(t.Record(t.String(), t.Unknown())),
          action: t.Optional(t.String()),
          icon: t.Optional(t.String()),
          badge: t.Optional(t.Integer()),
          tag: t.Optional(t.String()),
          color: t.Optional(t.String()),
          sound: t.Optional(t.String()),
          critical: t.Optional(t.Boolean()),
          draft: t.Optional(t.Boolean()),
          scheduledAt: t.Optional(t.String()),
        }),
        response: MessageObjectSchema,
      },
      async ({ request, params, body }) => {
        requireAdmin(getAuth(request))
        return (await resolve(svcR, request)).updatePush(params.messageId, {
          ...body,
          body: body.pushBody,
        })
      },
    )
    .delete(
      '/messaging/messages/:messageId',
      { response: t.Object({ ok: t.Boolean() }) },
      async ({ request, params, set }) => {
        requireAdmin(getAuth(request))
        await (await resolve(svcR, request)).deleteMessage(params.messageId)
        set.status = 204
        return { ok: true }
      },
    )
}

// ---------- Composite export ----------

export interface MessagingRoutesOptions {
  providers: ProvidersServiceResolver
  topics: TopicsServiceResolver
  subscribers: SubscribersServiceResolver
  messages: MessagesServiceResolver
  getCallerAuth?: CallerAuthResolver
}

export function messagingRoutes(opts: MessagingRoutesOptions) {
  const getAuth: CallerAuthResolver =
    opts.getCallerAuth ?? (() => ({ isAdmin: true, isKey: false, roles: [] }))
  return new Elysia({ name: 'messaging-routes' })
    .use(providersRoutes(opts.providers, getAuth))
    .use(topicsRoutes(opts.topics, getAuth))
    .use(subscribersRoutes(opts.subscribers, getAuth))
    .use(messagesRoutes(opts.messages, getAuth))
}
