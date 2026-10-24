import { describe, expect, it } from 'bun:test'
import { AppleOAuth2 } from './apple'
import { GoogleOAuth2 } from './google'
import { OAuth2ProviderError } from './provider'
import { redirectRules, validateRedirectURL } from './redirect'
import { getOAuth2Provider, isOAuthProviderKey } from './registry'

describe('oauth registry', () => {
  it('exposes google and apple', () => {
    expect(isOAuthProviderKey('google')).toBe(true)
    expect(isOAuthProviderKey('apple')).toBe(true)
    expect(isOAuthProviderKey('github')).toBe(false)
    expect(getOAuth2Provider('google')).toBe(GoogleOAuth2)
    expect(getOAuth2Provider('apple')).toBe(AppleOAuth2)
  })

  it('rejects unknown providers with a provider error', () => {
    expect(() => getOAuth2Provider('github')).toThrow(OAuth2ProviderError)
  })
})

describe('google provider', () => {
  const google = new GoogleOAuth2(
    'client-id',
    'client-secret',
    'https://api.example.com/v2/account/sessions/oauth2/google/callback',
    {
      success: 'https://app.example.com/done',
      failure: 'https://app.example.com/oops',
      token: false,
    },
    [],
  )

  it('builds the legacy authorize URL', () => {
    const url = new URL(google.getLoginURL())
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('client-id')
    expect(url.searchParams.get('redirect_uri')).toContain('/oauth2/google/callback')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(JSON.parse(url.searchParams.get('state')!)).toEqual({
      success: 'https://app.example.com/done',
      failure: 'https://app.example.com/oops',
      token: false,
    })
    expect(url.searchParams.get('scope')).toContain('userinfo.email')
    expect(url.searchParams.get('scope')).toContain('openid')
  })

  it('parses state JSON', async () => {
    const state = await google.parseState(
      decodeURIComponent(google.getLoginURL().split('state=')[1]!.split('&')[0]!),
    )
    expect((state as { success: string }).success).toBe('https://app.example.com/done')
  })
})

describe('apple provider', () => {
  it('builds the legacy authorize URL (form_post)', () => {
    const apple = new AppleOAuth2('com.example.app', '{}', 'https://cb', {
      token: true,
    })
    const url = new URL(apple.getLoginURL())
    expect(url.origin + url.pathname).toBe('https://appleid.apple.com/auth/authorize')
    expect(url.searchParams.get('response_mode')).toBe('form_post')
    expect(JSON.parse(url.searchParams.get('state')!)).toEqual({ token: true })
  })

  it('rejects non-JSON secrets with a provider error', async () => {
    const apple = new AppleOAuth2('com.example.app', 'not-json', 'https://cb')
    await expect(
      // getTokens is protected; exercise via refreshTokens which also needs the secret
      apple.refreshTokens('r'),
    ).rejects.toThrow(OAuth2ProviderError)
  })

  it('decodes id_token claims', () => {
    const apple = new AppleOAuth2('app', '{}', 'https://cb')
    const claims = { sub: 'user-1', email: 'a@b.c', email_verified: true }
    const token = `x.${btoa(JSON.stringify(claims))}.y`
    // private member access via any-cast (test-only)
    ;(
      apple as unknown as {
        hydrateClaims(): void
        tokens: Record<string, unknown>
      }
    ).tokens = { id_token: token }
    ;(apple as unknown as { hydrateClaims(): void }).hydrateClaims()
    expect((apple as unknown as { claims: Record<string, unknown> }).claims).toEqual(claims)
  })
})

describe('redirect validation', () => {
  const rules = redirectRules('proj_1', [
    { type: 'web', hostname: 'app.example.com' },
    { type: 'scheme', key: 'myapp' },
  ])

  it('allows registered web hostnames', () => {
    expect(validateRedirectURL('https://app.example.com/done', rules)).toBeNull()
    expect(validateRedirectURL('http://app.example.com', rules)).toBeNull()
  })

  it('rejects unregistered web hostnames with guidance', () => {
    const msg = validateRedirectURL('https://evil.example.com/done', rules)
    expect(msg).toContain('evil.example.com')
    expect(msg).toContain('console')
  })

  it('allows registered custom schemes and reserved schemes', () => {
    expect(validateRedirectURL('myapp://callback', rules)).toBeNull()
    expect(validateRedirectURL('exp://callback', rules)).toBeNull()
    // Real project IDs (D28) are alphanumeric — scheme grammar safe.
    const idRules = redirectRules('665a3b1f0012', [{ type: 'web', hostname: 'app.example.com' }])
    expect(validateRedirectURL('nuvix-callback-665a3b1f0012://cb', idRules)).toBeNull()
  })

  it('rejects unknown schemes with guidance', () => {
    expect(validateRedirectURL('unknown://cb', rules)).toContain('nuvix-callback-')
  })

  it('rejects empty/malformed URLs', () => {
    expect(validateRedirectURL('', rules)).toBe('Invalid URI.')
    expect(validateRedirectURL('not a url', rules)).toBe('Invalid URI.')
  })
})
