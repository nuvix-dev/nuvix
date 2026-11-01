/** Composition of the users subsystem: core routes plus sessions and push targets. */
import { Elysia } from 'elysia'
import type { GeoIP } from '../context/geoip'
import { userCoreRoutes } from './routes'
import { userSessionsRoutes } from './sessions/routes'
import { userTargetsRoutes } from './targets/routes'

export interface UserRoutesOptions {
  jwtSecret?: string
  /** GeoIP provider for log decoration (optional; degrades to unknown). */
  geoip?: GeoIP
}

/** Compose user routes. */
export const userRoutes = (options: UserRoutesOptions = {}) =>
  new Elysia({ prefix: '/users' })
    .use(userCoreRoutes(options))
    .use(userSessionsRoutes())
    .use(userTargetsRoutes())
