import { AppleOAuth2 } from './apple'
import { GoogleOAuth2 } from './google'
import { type OAuth2Provider, OAuth2ProviderError } from './provider'

/** Constructor shape every concrete provider shares (legacy parity). */
export type OAuth2ProviderCtor = new (
  appId: string,
  appSecret: string,
  callback: string,
  state?: Record<string, unknown>,
  scopes?: string[],
) => OAuth2Provider

/**
 * Static OAuth2 provider registry (legacy used dynamic file-import; v2 keeps
 * an explicit map — no runtime import surprises under Bun's bundler). A
 * provider is only usable when the project's `oAuthProviders` entry names a
 * key present here AND has credentials configured.
 */
export const oauthProviders: Record<string, OAuth2ProviderCtor> = {
  google: GoogleOAuth2,
  apple: AppleOAuth2,
}

export function isOAuthProviderKey(name: string): boolean {
  return Object.hasOwn(oauthProviders, name)
}

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
