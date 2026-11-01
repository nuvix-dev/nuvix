/** Sign in with Apple: form_post authorize flow, ES256 client-secret JWT, and id_token-based profiles. */
import type { TokensResponse } from './provider'
import { OAuth2Provider, OAuth2ProviderError } from './provider'

/**
 * Apple specializes the abstract provider: authorization uses
 * `response_mode=form_post`, tokens carry an `id_token` whose claims
 * supply the user identity, and the client secret must be a signed JWT
 * minted from the project's private key material.
 */
export class AppleOAuth2 extends OAuth2Provider {
  protected user: Record<string, unknown> = {}
  protected tokens: TokensResponse = {}
  protected claims: Record<string, unknown> = {}
  protected override scopes: string[] = ['name', 'email']

  private clientSecretJwt: string | undefined

  getName(): string {
    return 'apple'
  }

  getLoginURL(): string {
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

  /** Exchange the authorization code, caching the response and hydrating claims. */
  protected async getTokens(code: string): Promise<TokensResponse> {
    if (Object.keys(this.tokens).length === 0) {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.appID,
        client_secret: await this.getAppSecret(),
        redirect_uri: this.callback,
      }).toString()

      this.tokens = await this.request(
        'POST',
        'https://appleid.apple.com/auth/token',
        { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      )

      this.hydrateClaims()
    }

    return this.tokens
  }

  async refreshTokens(refreshToken: string): Promise<TokensResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.appID,
      client_secret: await this.getAppSecret(),
    }).toString()

    this.tokens = await this.request(
      'POST',
      'https://appleid.apple.com/auth/token',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    )

    if (!this.tokens.refresh_token) {
      this.tokens.refresh_token = refreshToken
    }

    this.hydrateClaims()
    return this.tokens
  }

  /**
   * Apple profiles arrive inside the signed `id_token` claims. The user's
   * display name is only available via the POSTed `user` form param on first
   * authorization (the service layer resolves it from callback params).
   */
  async getUserID(_accessToken: string): Promise<string> {
    return 'sub' in this.claims ? String(this.claims.sub) : ''
  }

  async getUserEmail(_accessToken: string): Promise<string> {
    return 'email' in this.claims ? String(this.claims.email) : ''
  }

  async isEmailVerified(_accessToken: string): Promise<boolean> {
    return Boolean(this.claims.email_verified)
  }

  async getUserName(_accessToken: string): Promise<string> {
    return ''
  }

  /**
   * Apple's `client_secret` is a signed ES256 JWT built from the project's
   * stored secret blob (`{"p8","keyID","teamID"}`), minted once per process
   * with a 180-day expiry, cached for the process lifetime.
   */
  private async getAppSecret(): Promise<string> {
    if (this.clientSecretJwt) return this.clientSecretJwt

    let secret: { p8?: string; keyID?: string; teamID?: string }
    try {
      secret = JSON.parse(this.appSecret) as typeof secret
    } catch {
      throw new OAuth2ProviderError(
        'Invalid Apple secret: expected a JSON blob with p8, keyID and teamID fields',
        400,
      )
    }

    const keyfile = secret.p8 ?? ''
    const keyID = secret.keyID ?? ''
    const teamID = secret.teamID ?? ''
    const bundleID = this.appID

    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'ES256', kid: keyID }
    const claims = {
      iss: teamID,
      iat: now,
      exp: now + 86400 * 180,
      aud: 'https://appleid.apple.com',
      sub: bundleID,
    }

    const payload = `${encodeUrl(JSON.stringify(header))}.${encodeUrl(JSON.stringify(claims))}`
    const p8 = keyfile
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s+/g, '')
    const der = Uint8Array.from(atob(p8), (c) => c.charCodeAt(0))

    const key = await crypto.subtle.importKey(
      'pkcs8',
      der as unknown as ArrayBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )

    const signature = new Uint8Array(
      await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        new TextEncoder().encode(payload),
      ),
    )

    // ES256 JWS: WebCrypto yields a DER-encoded ECDSA-Sig-Value; the JWS
    // signature is raw `r || s` with each half zero-padded to 32 bytes.
    const { r, s } = derToRawPair(signature)
    const jwsSig = base64Url(concat(r, s))

    this.clientSecretJwt = `${payload}.${jwsSig}`
    return this.clientSecretJwt
  }

  /** Extract identity claims from the `id_token` (or the `user` form param fallback). */
  private hydrateClaims(): void {
    if (this.tokens.id_token) {
      this.claims = this.decodeIdToken(this.tokens.id_token)
    } else if (this.tokens.user) {
      try {
        this.user =
          typeof this.tokens.user === 'string'
            ? (JSON.parse(this.tokens.user) as Record<string, unknown>)
            : (this.tokens.user as Record<string, unknown>)
      } catch {
        this.user = {}
      }
    }
  }
}

/** Unpadded URL-safe base64 encoder used for the JWS segments. */
function base64Url(input: string | Uint8Array): string {
  const raw = typeof input === 'string' ? Uint8Array.from(input, (c) => c.charCodeAt(0)) : input
  return btoa(String.fromCharCode(...raw))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function encodeUrl(input: string): string {
  return base64Url(input)
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.byteLength + b.byteLength)
  out.set(a, 0)
  out.set(b, a.byteLength)
  return out
}

/** Converts a WebCrypto DER `ECDSA-Sig-Value` into zero-padded `r || s`. */
function derToRawPair(der: Uint8Array): { r: Uint8Array; s: Uint8Array } {
  // Layout: 0x30 <total-len> 0x02 <rlen> <r bytes> 0x02 <slen> <s bytes>
  const totalLen = der[1] ?? 0
  // Handle multi-byte length only if needed; P-256 sigs stay short (<128... DER padded).
  let offset = 2
  if (totalLen > 0x80) offset += (totalLen & 0x7f) - 1 + 1
  if (der[offset] !== 0x02) throw new Error('Invalid ECDSA signature encoding')
  const rLen = der[offset + 1] ?? 0
  const r = der.slice(offset + 2, offset + 2 + rLen)
  offset += 2 + rLen
  if (der[offset] !== 0x02) throw new Error('Invalid ECDSA signature encoding')
  const sLen = der[offset + 1] ?? 0
  const s = der.slice(offset + 2, offset + 2 + sLen)

  return { r: padTo(32, r), s: padTo(32, s) }
}

function padTo(len: number, value: Uint8Array): Uint8Array {
  if (value.byteLength >= len) return value.slice(value.byteLength - len)
  const out = new Uint8Array(len)
  out.set(value, len - value.byteLength)
  return out
}
