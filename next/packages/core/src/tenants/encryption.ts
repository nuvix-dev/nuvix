/**
 * At-rest encryption for tenant connection secrets (D37).
 *
 * The platform registry stores each project's tenant password encrypted
 * with a server-held key — never in plaintext. AES-256-GCM via
 * `crypto.subtle` (Bun-native, matches the hand-rolled-on-`crypto.subtle`
 * precedent already set for JWT in D6).
 */

const ALGORITHM = 'AES-GCM'
const IV_BYTES = 12

async function importKey(rawKey: Uint8Array): Promise<CryptoKey> {
  if (rawKey.length !== 32) {
    throw new Error(`Tenant target encryption key must be 32 bytes, got ${rawKey.length}`)
  }
  // `Uint8Array<ArrayBufferLike>` (e.g. from `Buffer.from`) isn't assignable to
  // WebCrypto's `BufferSource` under the strict DOM lib; a defensive copy
  // guarantees a plain `ArrayBuffer`-backed view.
  return crypto.subtle.importKey('raw', Uint8Array.from(rawKey), ALGORITHM, false, [
    'encrypt',
    'decrypt',
  ])
}

/** Decodes a 32-byte key from a base64 string (see `NUVIX_TENANT_ENCRYPTION_KEY`). */
export function decodeEncryptionKey(base64Key: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64Key, 'base64'))
}

/** Encrypts `plaintext`; returns a self-contained base64 blob (iv + ciphertext + tag). */
export async function encryptSecret(plaintext: string, rawKey: Uint8Array): Promise<string> {
  const key = await importKey(rawKey)
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return Buffer.from(combined).toString('base64')
}

/** Reverses {@link encryptSecret}. Throws if the blob was tampered with or the key is wrong. */
export async function decryptSecret(blob: string, rawKey: Uint8Array): Promise<string> {
  const key = await importKey(rawKey)
  const combined = new Uint8Array(Buffer.from(blob, 'base64'))
  const iv = combined.subarray(0, IV_BYTES)
  const ciphertext = combined.subarray(IV_BYTES)
  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}
