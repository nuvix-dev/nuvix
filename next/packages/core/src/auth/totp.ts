import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i]
    if (byte === undefined) continue
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31] ?? ''
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31] ?? ''
  }

  return output
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]
    if (!char) continue
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) {
      continue
    }
    value = (value << 5) | idx
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

export function generateTotpSecret(length = 20): string {
  return base32Encode(randomBytes(length))
}

export function generateTotpCode(secret: string, timestamp = Date.now(), period = 30): string {
  const key = base32Decode(secret)
  const counter = Math.floor(timestamp / 1000 / period)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigInt64BE(BigInt(counter))

  const hmac = createHmac('sha1', key).update(counterBuffer).digest()
  const lastByte = hmac[hmac.length - 1] ?? 0
  const offset = lastByte & 0x0f
  const b0 = hmac[offset] ?? 0
  const b1 = hmac[offset + 1] ?? 0
  const b2 = hmac[offset + 2] ?? 0
  const b3 = hmac[offset + 3] ?? 0

  const binary = ((b0 & 0x7f) << 24) | ((b1 & 0xff) << 16) | ((b2 & 0xff) << 8) | (b3 & 0xff)

  const otp = (binary % 1_000_000).toString().padStart(6, '0')
  return otp
}

export function verifyTotpCode(
  otp: string,
  secret: string,
  options: { window?: number; timestamp?: number; period?: number } = {},
): boolean {
  if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
    return false
  }
  const window = options.window ?? 1
  const period = options.period ?? 30
  const timestamp = options.timestamp ?? Date.now()

  const target = otp.trim()
  for (let i = -window; i <= window; i++) {
    const t = timestamp + i * period * 1000
    const generated = generateTotpCode(secret, t, period)
    const bufA = Buffer.from(generated, 'utf-8')
    const bufB = Buffer.from(target, 'utf-8')
    if (bufA.length === bufB.length && timingSafeEqual(bufA, bufB)) {
      return true
    }
  }
  return false
}

export interface TotpUriOptions {
  secret: string
  label: string
  issuer: string
}

export function getTotpUri({ secret, label, issuer }: TotpUriOptions): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedLabel = encodeURIComponent(label)
  return `otpauth://totp/${encodedIssuer}:${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`
}
