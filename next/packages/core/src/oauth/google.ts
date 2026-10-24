import type { TokensResponse } from './provider'
import { OAuth2Provider } from './provider'

export class GoogleOAuth2 extends OAuth2Provider {
  protected user: Record<string, unknown> = {}
  protected tokens: TokensResponse = {}
  protected override scopes: string[] = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid',
  ]

  getName(): string {
    return 'google'
  }

  getLoginURL(): string {
    return (
      'https://accounts.google.com/o/oauth2/v2/auth?' +
      new URLSearchParams({
        client_id: this.appID,
        redirect_uri: this.callback,
        scope: this.getScopes().join(' '),
        state: JSON.stringify(this.state),
        response_type: 'code',
      }).toString()
    )
  }

  protected async getTokens(code: string): Promise<TokensResponse> {
    if (Object.keys(this.tokens).length === 0) {
      const params = new URLSearchParams({
        code,
        client_id: this.appID,
        client_secret: this.appSecret,
        redirect_uri: this.callback,
        grant_type: 'authorization_code',
      })

      this.tokens = await this.request(
        'POST',
        `https://oauth2.googleapis.com/token?${params.toString()}`,
      )
    }

    return this.tokens
  }

  async refreshTokens(refreshToken: string): Promise<TokensResponse> {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.appID,
      client_secret: this.appSecret,
      grant_type: 'refresh_token',
    })

    this.tokens = await this.request(
      'POST',
      `https://oauth2.googleapis.com/token?${params.toString()}`,
    )

    if (!this.tokens.refresh_token) {
      this.tokens.refresh_token = refreshToken
    }

    return this.tokens
  }

  async getUserID(accessToken: string): Promise<string> {
    const user = await this.getUser(accessToken)
    return user.sub ? String(user.sub) : ''
  }

  async getUserEmail(accessToken: string): Promise<string> {
    const user = await this.getUser(accessToken)
    return user.email ? String(user.email) : ''
  }

  async isEmailVerified(accessToken: string): Promise<boolean> {
    const user = await this.getUser(accessToken)
    return Boolean(user.email_verified)
  }

  async getUserName(accessToken: string): Promise<string> {
    const user = await this.getUser(accessToken)
    return user.name ? String(user.name) : ''
  }

  protected async getUser(accessToken: string): Promise<Record<string, unknown>> {
    if (Object.keys(this.user).length === 0) {
      this.user = await this.request(
        'GET',
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${encodeURIComponent(accessToken)}`,
      )
    }

    return this.user
  }
}
