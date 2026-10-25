import type { QueueManager } from '@nuvix/core/queues'
import { Elysia } from 'elysia'
import { messagingMessagesRoutes } from './messages/routes'
import { messagingProvidersRoutes } from './providers/routes'
import { messagingSubscribersRoutes } from './subscribers/routes'
import { messagingTopicsRoutes } from './topics/routes'

export interface MessagingRouteDeps {
  /** Queue runtime — message delivery enqueue (undefined in tests). */
  queues?: QueueManager
}

export const messagingRoutes = ({ queues }: MessagingRouteDeps = {}) =>
  new Elysia({ prefix: '/messaging' })
    .use(messagingTopicsRoutes())
    .use(messagingSubscribersRoutes())
    .use(messagingProvidersRoutes())
    .use(messagingMessagesRoutes({ queues }))
