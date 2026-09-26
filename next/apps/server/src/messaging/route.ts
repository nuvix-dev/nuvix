import { Elysia } from 'elysia'
import { messagingMessagesRoutes } from './messages/routes'
import { messagingProvidersRoutes } from './providers/routes'
import { messagingSubscribersRoutes } from './subscribers/routes'
import { messagingTopicsRoutes } from './topics/routes'

export const messagingRoutes = () =>
  new Elysia({ prefix: '/messaging' })
    .use(messagingTopicsRoutes())
    .use(messagingSubscribersRoutes())
    .use(messagingProvidersRoutes())
    .use(messagingMessagesRoutes())
