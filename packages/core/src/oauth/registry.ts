import { AppleOAuth2 } from './apple'
import { GoogleOAuth2 } from './google'
import { type OAuth2Provider, OAuth2ProviderError } from './provider'

/** Constructor shape every concrete provider shares. */
export type OAuth2ProviderCtor = new (
  appId: string,
  appSecret: string,
  callback: string,
  state?: Record<string, unknown>,
  scopes?: string[],
) => OAuth2Provider

/**
 * Explicit OAuth2 provider registry (a static map rather than dynamic
 * imports, so bundling stays predictable under Bun). A
 * provider is only usable when the project's `oAuthProviders` entry names a
 * key present here AND has credentials configured.
 */
export const oauthProviders: Record<string, OAuth2ProviderCtor> = {
  google: GoogleOAuth2,
  apple: AppleOAuth2,
}

/** True when `name` is a registered provider id. */
export function isOAuthProviderKey(name: string): boolean {
  return Object.hasOwn(oauthProviders, name)
}

/** Resolve a provider class or fail with a 400-status provider error. */
export function getOAuth2Provider(name: string): OAuth2ProviderCtor {
  const Provider = oauthProviders[name]
  if (!Provider) {
    throw new OAuth2ProviderError(
      `OAuth2 provider '${name}' is not supported in this version of Nuvix`,
      400,
    )
  }
  return Provider
}
