/** Composition of the teams subsystem: core team routes plus memberships. */
import { Elysia } from 'elysia'
import { teamMembershipsRoutes } from './memberships/routes'
import { teamCoreRoutes } from './routes'

/** Compose team routes. */
export const teamRoutes = () =>
  new Elysia({ prefix: '/teams' }).use(teamCoreRoutes()).use(teamMembershipsRoutes())
