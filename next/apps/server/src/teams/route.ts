import { Elysia } from 'elysia'
import { teamMembershipsRoutes } from './memberships/routes'
import { teamCoreRoutes } from './routes'

export const teamRoutes = () =>
  new Elysia({ prefix: '/teams' }).use(teamCoreRoutes()).use(teamMembershipsRoutes())
