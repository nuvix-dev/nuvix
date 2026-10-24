/**
 * OAuth2 provider abstraction — Bun-native port of legacy
 * `libs/core/src/OAuth2.ts`, stripped of Nest typings and node-only deps.
 *
 * Each concrete provider (see `google.ts`, `apple.ts`) implements the
 * authorize-URL/token-exchange/user-profile surface as defined by the
 * upstream provider. The legacy wire contract (URL shapes, scopes, state
 * serialization) is preserved 1:1 so existing provider apps keep working.
 */

export interface OAuth2State {
  /** Success redirect URL (validated against the project's platforms). */
  success: string
  /** Failure redirect URL (validated against the project's platforms). */
  failure: string
  /**
   * `true` when the flow must return an OAuth2 token (userId + secret query
   * params) instead of creating a session (legacy `tokens/oauth2` flow).
   */
  token?: boolean
}

/** Failure classification carried to the provider-failure redirect. */
export class OAuth2ProviderError extends Error {
  /** HTTP-ish status used to select the failure severity (400/401/else). */
  readonly status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'OAuth2ProviderError'
    this.status = status
  }
}

export abstract class OAuth2Provider {
  protected readonly appID: string
  protected readonly appSecret: string
  protected readonly callback: string
  protected readonly state: Record<string, unknown>
  protected scopes: string[] = []

  constructor(
    appId: string,
    appSecret: string,
    callback: string,
    state: Record<string, unknown> = {},
    scopes: string[] = [],
  ) {
    this.appID = appId
    this.appSecret = appSecret
    this.callback = callback
    this.state = state
    for (const scope of scopes) this.addScope(scope)
  }

  abstract getName(): string

  abstract getLoginURL(): string

  protected abstract getTokens(code: string): Promise<TokensResponse>

  abstract refreshTokens(refreshToken: string): Promise<TokensResponse>

  abstract getUserID(accessToken: string): Promise<string>

  abstract getUserEmail(accessToken: string): Promise<string>

  abstract isEmailVerified(accessToken: string): Promise<boolean>

  abstract getUserName(accessToken: string): Promise<string>

  protected addScope(scope: string): this {
    if (!this.scopes.includes(scope)) this.scopes.push(scope)
    return this
  }

  protected getScopes(): string[] {
    return this.scopes
  }

  async parseState(state: string): Promise<Record<string, unknown>> {
    return JSON.parse(state)
  }

  async getAccessToken(code: string): Promise<string> {
    return (await this.getTokens(code)).access_token ?? ''
  }

  async getRefreshToken(code: string): Promise<string> {
    return (await this.getTokens(code)).refresh_token ?? ''
  }

  async getAccessTokenExpiry(code: string): Promise<number> {
    const tokens = await this.getTokens(code)
    return typeof tokens.expires_in === 'number' ? tokens.expires_in : 0
  }

  protected async request(
    method: 'GET' | 'POST',
    url: string,
    headers: Record<string, string> = {},
    payload = '',
  ): Promise<Record<string, unknown>> {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...headers,
        'user-agent': 'Nuvix OAuth2 Client',
      },
      body: payload || undefined,
    })

    if (!response.ok) {
      throw new OAuth2ProviderError(JSON.stringify(await response.text()), response.status)
    }

    return (await response.json()) as Record<string, unknown>
  }

  /** Decodes a JWT-shaped `id_token` payload (Apple profile claims). */
  protected decodeIdToken(idToken: string): Record<string, unknown> {
    const parts = idToken.split('.')
    if (parts.length < 2) return {}
    try {
      const bin = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
    } catch {
      return {}
    }
  }
}

export interface TokensResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  id_token?: string
  [key: string]: unknown
}
