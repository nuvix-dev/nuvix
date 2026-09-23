/**
 * Pure Web Crypto RFC-6238 TOTP (Time-Based One-Time Password) implementation.
 *
 * Implements HMAC-SHA1 over 30-second steps with 6-digit output.
 * Zero external dependencies — runs on standard `crypto.subtle`.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buffer: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i] ?? 0
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

export function base32Decode(input: string): Uint8Array {
  const cleanInput = input.toUpperCase().replace(/=+$/, '')
  let bits = 0
  let value = 0
  const output: number[] = []

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i] ?? ''
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${char}`)
    }

    value = (value << 5) | idx
    bits += 5

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return new Uint8Array(output)
}

/**
 * Generate a cryptographically random Base32 TOTP secret.
 * 20 bytes = 160 bits of entropy -> 32 Base32 characters.
 */
export function generateTotpSecret(byteLength = 20): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base32Encode(bytes)
}

/**
 * Generate standard otpauth:// provisioning URI for QR code generation.
 */
export function generateTotpUri(
  label: string,
  issuer: string,
  secret: string,
  digits = 6,
  period = 30,
): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedLabel = encodeURIComponent(label)
  return `otpauth://totp/${encodedIssuer}:${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${digits}&period=${period}`
}

/**
 * Compute the 6-digit TOTP code for a secret at a specific timestamp.
 */
export async function generateTotp(
  secret: string,
  timestampMs: number = Date.now(),
  stepSeconds = 30,
  digits = 6,
): Promise<string> {
  const keyBytes = base32Decode(secret)
  const counter = Math.floor(timestampMs / 1000 / stepSeconds)

  const counterBuffer = new ArrayBuffer(8)
  const counterView = new DataView(counterBuffer)
  // Counter is big-endian 64-bit int; upper 32 bits and lower 32 bits
  counterView.setUint32(0, Math.floor(counter / 0x100000000), false)
  counterView.setUint32(4, counter >>> 0, false)

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, counterBuffer)
  const hmac = new Uint8Array(signature)

  const lastByte = hmac[hmac.length - 1] ?? 0
  const offset = lastByte & 0x0f

  const byte0 = hmac[offset] ?? 0
  const byte1 = hmac[offset + 1] ?? 0
  const byte2 = hmac[offset + 2] ?? 0
  const byte3 = hmac[offset + 3] ?? 0

  const binary =
    ((byte0 & 0x7f) << 24) |
    ((byte1 & 0xff) << 16) |
    ((byte2 & 0xff) << 8) |
    (byte3 & 0xff)

  const modulo = 10 ** digits
  const otp = binary % modulo

  return otp.toString().padStart(digits, '0')
}

/**
 * Verify a TOTP code against a secret within a time skew window.
 * Default window = 1 allows 1 step before and 1 step after (30s tolerance).
 */
export async function verifyTotp(
  code: string,
  secret: string,
  window = 1,
  timestampMs: number = Date.now(),
  stepSeconds = 30,
  digits = 6,
): Promise<boolean> {
  if (!code || code.length !== digits) return false

  for (let i = -window; i <= window; i++) {
    const stepTime = timestampMs + i * stepSeconds * 1000
    const expected = await generateTotp(secret, stepTime, stepSeconds, digits)
    if (code === expected) {
      return true
    }
  }

  return false
}
