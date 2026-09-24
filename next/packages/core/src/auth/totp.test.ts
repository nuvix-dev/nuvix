import { describe, expect, it } from 'bun:test'
import {
  base32Decode,
  base32Encode,
  generateTotpCode,
  generateTotpSecret,
  getTotpUri,
  verifyTotpCode,
} from './totp'

describe('TOTP helper', () => {
  it('round-trips buffer through base32', () => {
    const original = Buffer.from('hello world', 'utf-8')
    const encoded = base32Encode(original)
    const decoded = base32Decode(encoded)
    expect(decoded.toString('utf-8')).toBe('hello world')
  })

  it('generates a secret of valid base32 characters', () => {
    const secret = generateTotpSecret(20)
    expect(secret.length).toBeGreaterThan(0)
    expect(base32Decode(secret).length).toBe(20)
  })

  it('generates and verifies 6-digit OTP code', () => {
    const secret = generateTotpSecret(20)
    const code = generateTotpCode(secret)
    expect(code).toMatch(/^\d{6}$/)
    expect(verifyTotpCode(code, secret)).toBe(true)
  })

  it('rejects an incorrect OTP code', () => {
    const secret = generateTotpSecret(20)
    expect(verifyTotpCode('000000', secret)).toBe(false)
  })

  it('constructs standard otpauth URI', () => {
    const uri = getTotpUri({
      secret: 'JBSWY3DPEHPK3PXP',
      label: 'user@example.com',
      issuer: 'Nuvix',
    })
    expect(uri).toContain('otpauth://totp/Nuvix:user%40example.com')
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
    expect(uri).toContain('issuer=Nuvix')
  })
})
