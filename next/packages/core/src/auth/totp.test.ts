import { describe, expect, it } from 'bun:test'
import {
  base32Decode,
  base32Encode,
  generateTotp,
  generateTotpSecret,
  generateTotpUri,
  verifyTotp,
} from './totp'

describe('RFC-6238 TOTP', () => {
  // Standard RFC-6238 test secret "12345678901234567890" in Base32:
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

  it('correctly encodes and decodes Base32', () => {
    const original = new TextEncoder().encode('Hello World!')
    const encoded = base32Encode(original)
    const decoded = base32Decode(encoded)
    expect(new TextDecoder().decode(decoded)).toBe('Hello World!')
  })

  it('matches RFC-6238 SHA1 test vectors', async () => {
    // RFC 6238 Appendix B test vectors for SHA-1 (30s step):
    // T = 59s -> 287082
    expect(await generateTotp(rfcSecret, 59 * 1000)).toBe('287082')

    // T = 1111111109s -> 081804
    expect(await generateTotp(rfcSecret, 1111111109 * 1000)).toBe('081804')

    // T = 1111111111s -> 050471
    expect(await generateTotp(rfcSecret, 1111111111 * 1000)).toBe('050471')

    // T = 1234567890s -> 005924
    expect(await generateTotp(rfcSecret, 1234567890 * 1000)).toBe('005924')

    // T = 2000000000s -> 279037
    expect(await generateTotp(rfcSecret, 2000000000 * 1000)).toBe('279037')
  })

  it('generates a 32-char Base32 secret', () => {
    const secret = generateTotpSecret()
    expect(secret.length).toBe(32)
    expect(() => base32Decode(secret)).not.toThrow()
  })

  it('generates standard provisioning URI', () => {
    const uri = generateTotpUri('ada@example.com', 'Nuvix', rfcSecret)
    expect(uri).toContain('otpauth://totp/Nuvix:ada%40example.com')
    expect(uri).toContain(`secret=${rfcSecret}`)
    expect(uri).toContain('issuer=Nuvix')
  })

  it('verifies valid TOTP within window', async () => {
    const time = 1234567890 * 1000
    const code = await generateTotp(rfcSecret, time)

    // Exact match
    expect(await verifyTotp(code, rfcSecret, 1, time)).toBe(true)

    // Within window (previous step: -30s)
    expect(await verifyTotp(code, rfcSecret, 1, time + 30 * 1000)).toBe(true)

    // Within window (next step: +30s)
    expect(await verifyTotp(code, rfcSecret, 1, time - 30 * 1000)).toBe(true)

    // Outside window (+65s)
    expect(await verifyTotp(code, rfcSecret, 1, time + 65 * 1000)).toBe(false)

    // Invalid code
    expect(await verifyTotp('999999', rfcSecret, 1, time)).toBe(false)
  })
})
