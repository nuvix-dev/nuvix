import { Elysia } from 'elysia'
import { userCoreRoutes } from './routes'
import { userSessionsRoutes } from './sessions/routes'
import { userTargetsRoutes } from './targets/routes'

export interface UserRoutesOptions {
  jwtSecret?: string
}

export const userRoutes = (options: UserRoutesOptions = {}) =>
  new Elysia({ prefix: '/users' })
    .use(userCoreRoutes(options))
    .use(userSessionsRoutes())
    .use(userTargetsRoutes())
