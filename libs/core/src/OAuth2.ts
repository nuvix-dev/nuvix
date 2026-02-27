import { Exception } from './extend/exception'

/**
 * OAuth2 abstract class for authentication providers
 */
export abstract class OAuth2 {
  protected appID: string
  protected appSecret: string
  protected callback: string
  protected state: Record<string, unknown>
  protected scopes: string[] = []

  /**
   * OAuth2 constructor
   */
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

    for (const scope of scopes) {
      this.addScope(scope)
    }
  }

  /**
   * Get the name of the OAuth provider
   */
  abstract getName(): string

  /**
   * Get the login URL for the OAuth provider
   */
  abstract getLoginURL(): string

  /**
   * Exchange the authorization code for tokens
   */
  protected abstract getTokens(code: string): Promise<Record<string, any>>

  /**
   * Refresh the access token using a refresh token
   */
  abstract refreshTokens(refreshToken: string): Promise<Record<string, any>>

  /**
   * Get the user ID from the OAuth provider
   */
  abstract getUserID(accessToken: string): Promise<string>

  /**
   * Get the user email from the OAuth provider
   */
  abstract getUserEmail(accessToken: string): Promise<string>

  /**
   * Check if the OAuth email is verified
   */
  abstract isEmailVerified(accessToken: string): Promise<boolean>

  /**
   * Get the user name from the OAuth provider
   */
  abstract getUserName(accessToken: string): Promise<string>

  /**
   * Add a scope to the OAuth request
   */
  protected addScope(scope: string): this {
    // Add a scope to the scopes array if it isn't already present
    if (!this.scopes.includes(scope)) {
      this.scopes.push(scope)
    }

    return this
  }

  /**
   * Get the currently requested OAuth scopes
   */
  protected getScopes(): string[] {
    return this.scopes
  }

  /**
   * Get the access token from an authorization code
   */
  public async getAccessToken(code: string): Promise<string> {
    const tokens = await this.getTokens(code)
    return tokens.access_token || ''
  }

  /**
   * Get the refresh token from an authorization code
   */
  public async getRefreshToken(code: string): Promise<string> {
    const tokens = await this.getTokens(code)
    return tokens.refresh_token || ''
  }

  /**
   * Get the access token expiry time
   */
  public async getAccessTokenExpiry(code: string): Promise<number> {
    const tokens = await this.getTokens(code)
    return tokens.expires_in || 0
  }

  /**
   * Parse the state parameter returned from the OAuth provider
   */
  public parseState(state: string): Record<string, unknown> {
    return JSON.parse(state)
  }

  /**
   * Make an HTTP request to the OAuth provider
   */
  protected async request(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    payload = '',
  ): Promise<Record<string, unknown>> {
    const requestOptions: RequestInit = {
      method,
      headers: {
        Accept: 'application/json',
        ...headers,
        'user-agent': 'Nuvix OAuth2 Client',
      },
      body: payload || undefined,
    }

    const response = await fetch(url, requestOptions)

    if (!response.ok) {
      throw new OAuth2Error(await response.json(), response.status)
    }

    return response.json()
  }
}

/**
 * OAuth2Error class for handling OAuth2 errors
 */
export class OAuth2Error extends Exception {
  protected error = ''
  protected errorDescription = ''

  constructor(response: Record<string, unknown>, code = 0, previous?: Error) {
    super()
    this.message = JSON.stringify(response)
    try {
      const decoded: any = response
      if (decoded) {
        if (decoded.error && typeof decoded.error === 'object') {
          this.error = decoded.error.status || 'Unknown error'
          this.errorDescription = decoded.error.message || 'No description'
        } else if (Array.isArray(decoded.errors)) {
          this.error = decoded.error || decoded.message || 'Unknown error'
          this.errorDescription = decoded.errors[0]?.message || 'No description'
        } else {
          this.error = decoded.error || decoded.message || 'Unknown error'
          this.errorDescription = decoded.error_description || 'No description'
        }

        this.message = `${this.error}: ${this.errorDescription}`
      }

      // Set the appropriate error type based on the code
      const type =
        code === 400
          ? Exception.USER_OAUTH2_BAD_REQUEST
          : code === 401
            ? Exception.USER_OAUTH2_UNAUTHORIZED
            : Exception.USER_OAUTH2_PROVIDER_ERROR

      this.setType(type)

      if (previous) {
        this.cause = previous
      }
    } catch (_e) {
      // If parsing fails, keep the original response as the message
    }
  }
}

export const getOAuth2Class = async <T extends OAuth2>(
  provider: string,
): Promise<
  new (
    appId: string,
    appSecret: string,
    callback: string,
    state?: Record<string, unknown>,
    scopes?: string[],
  ) => T
> => {
  try {
    // Dynamic import of OAuth2 provider class
    const authModule = await import(
      /* webpackChunkName: "OAuth2" */
      `./OAuth2/${provider.toLowerCase()}.ts`
    )

    const className = `${provider.charAt(0).toUpperCase() + provider.slice(1)}OAuth2`

    if (!(className in authModule)) {
      throw new Exception(`OAuth2 provider class '${className}' not found`)
    }

    const AuthClass = authModule[className]

    // Validate that the class extends OAuth2
    if (!AuthClass.prototype || !(AuthClass.prototype instanceof OAuth2)) {
      throw new Exception(`Class '${className}' does not extend OAuth2`)
    }

    return AuthClass
  } catch (error) {
    if (error instanceof Exception) {
      throw error
    }
    throw new Exception(
      `Failed to load OAuth2 provider '${provider}': ${error}`,
    )
  }
}
