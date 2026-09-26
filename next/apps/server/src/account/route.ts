import { Elysia } from 'elysia'
import { accountIdentitiesRoutes } from './identities/routes'
import { accountMfaRoutes } from './mfa/routes'
import { accountProfileRoutes } from './profile/routes'
import { accountRecoveryRoutes } from './recovery/routes'
import { accountSessionsRoutes } from './sessions/routes'
import { accountTargetsRoutes } from './targets/routes'
import { accountTokensRoutes } from './tokens/routes'

export interface AccountRoutesOptions {
  jwtSecret?: string
}

export const accountRoutes = (options: AccountRoutesOptions = {}) =>
  new Elysia({ prefix: '/account' })
    .use(accountProfileRoutes())
    .use(accountRecoveryRoutes())
    .use(accountSessionsRoutes(options))
    .use(accountTokensRoutes(options))
    .use(accountIdentitiesRoutes())
    .use(accountTargetsRoutes())
    .use(accountMfaRoutes())
