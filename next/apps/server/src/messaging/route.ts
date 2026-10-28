/** Composes messaging topic, subscriber, provider, and message plugins under one route prefix. */
import type { QueueManager } from '@nuvix/core/queues'
import { Elysia } from 'elysia'
import { messagingMessagesRoutes } from './messages/routes'
import { messagingProvidersRoutes } from './providers/routes'
import { messagingSubscribersRoutes } from './subscribers/routes'
import { messagingTopicsRoutes } from './topics/routes'

export interface MessagingRouteDeps {
  /** Optional queue runtime used by message routes for delivery scheduling. */
  queues?: QueueManager
}

/** Mount messaging subroutes and pass the optional delivery queue to message handlers. */
export const messagingRoutes = ({ queues }: MessagingRouteDeps = {}) =>
  new Elysia({ prefix: '/messaging' })
    .use(messagingTopicsRoutes())
    .use(messagingSubscribersRoutes())
    .use(messagingProvidersRoutes())
    .use(messagingMessagesRoutes({ queues }))
