import { Elysia } from 'elysia'
import { accountIdentitiesRoutes } from './identities/routes'
import { accountMfaRoutes } from './mfa/routes'
import { type OAuth2RouteDeps, oauth2Routes } from './oauth2/routes'
import { accountProfileRoutes } from './profile/routes'
import { accountRecoveryRoutes } from './recovery/routes'
import { accountSessionsRoutes } from './sessions/routes'
import { accountTargetsRoutes } from './targets/routes'
import { accountTokensRoutes } from './tokens/routes'

export interface AccountRoutesOptions {
  jwtSecret?: string
  /** OAuth2 flow dependencies (control-plane registry + encryption key). */
  oauth2?: OAuth2RouteDeps
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
    .use(
      options.oauth2
        ? oauth2Routes(options.oauth2)
        : new Elysia({ name: 'account-oauth2-disabled' }),
    )
