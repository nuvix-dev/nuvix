import * as crypto from 'node:crypto'
import { OAuth2 } from '../OAuth2'

export class AppleOAuth2 extends OAuth2 {
  protected user: Record<string, any> = {}
  protected tokens: Record<string, any> = {}
  protected claims: Record<string, any> = {}
  protected override scopes: string[] = ['name', 'email']

  public getName(): string {
    return 'apple'
  }

  public getLoginURL(): string {
    return (
      'https://appleid.apple.com/auth/authorize?' +
      new URLSearchParams({
        client_id: this.appID,
        redirect_uri: this.callback,
        state: JSON.stringify(this.state),
        response_type: 'code',
        response_mode: 'form_post',
        scope: this.getScopes().join(' '),
      }).toString()
    )
  }

  protected async getTokens(code: string): Promise<Record<string, any>> {
    if (Object.keys(this.tokens).length === 0) {
      const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: this.appID,
        client_secret: this.getAppSecret(),
        redirect_uri: this.callback,
      }).toString()

      const response = await this.request(
        'POST',
        'https://appleid.apple.com/auth/token',
        headers,
        body,
      )
      this.tokens = response

      if (this.tokens.id_token) {
        const parts = this.tokens.id_token.split('.')
        if (parts.length > 1) {
          this.claims = JSON.parse(Buffer.from(parts[1], 'base64').toString())
        }
      }
    }

    return this.tokens
  }

  public async refreshTokens(
    refreshToken: string,
  ): Promise<Record<string, any>> {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.appID,
      client_secret: this.getAppSecret(),
    }).toString()

    const response = await this.request(
      'POST',
      'https://appleid.apple.com/auth/token',
      headers,
      body,
    )
    this.tokens = response

    if (!this.tokens.refresh_token) {
      this.tokens.refresh_token = refreshToken
    }

    if (this.tokens.id_token) {
      const parts = this.tokens.id_token.split('.')
      if (parts.length > 1) {
        this.claims = JSON.parse(Buffer.from(parts[1], 'base64').toString())
      }
    }

    return this.tokens
  }

  public async getUserID(_accessToken: string): Promise<string> {
    return this.claims.sub || ''
  }

  public async getUserEmail(_accessToken: string): Promise<string> {
    return this.claims.email || ''
  }

  public async isEmailVerified(_accessToken: string): Promise<boolean> {
    return Boolean(this.claims.email_verified)
  }

  public async getUserName(_accessToken: string): Promise<string> {
    return ''
  }

  private getAppSecret(): string {
    let secret: Record<string, string>
    try {
      secret = JSON.parse(this.appSecret)
    } catch {
      throw new Error('Invalid secret')
    }

    const keyfile = secret.p8 || ''
    const keyID = secret.keyID || ''
    const teamID = secret.teamID || ''
    const bundleID = this.appID

    const headers = {
      alg: 'ES256',
      kid: keyID,
    }

    const claims = {
      iss: teamID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 180,
      aud: 'https://appleid.apple.com',
      sub: bundleID,
    }

    const payload =
      this.encode(JSON.stringify(headers)) +
      '.' +
      this.encode(JSON.stringify(claims))

    try {
      const signature = crypto.createSign('sha256').update(payload).sign({
        key: keyfile,
        format: 'pem',
      })

      const signatureBase64 = this.encode(signature)
      return `${payload}.${signatureBase64}`
    } catch {
      return ''
    }
  }

  private encode(data: string | Buffer): string {
    const base64 = Buffer.isBuffer(data)
      ? data.toString('base64')
      : Buffer.from(data).toString('base64')
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }
}
