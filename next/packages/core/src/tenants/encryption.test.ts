import { describe, expect, test } from 'bun:test'
import { decodeEncryptionKey, decryptSecret, encryptSecret } from './encryption'

const key = crypto.getRandomValues(new Uint8Array(32))

describe('tenant target encryption', () => {
  test('round-trips plaintext', async () => {
    const blob = await encryptSecret('super-secret-password', key)
    expect(blob).not.toContain('super-secret-password')
    expect(await decryptSecret(blob, key)).toBe('super-secret-password')
  })

  test('produces a different ciphertext each time (random IV)', async () => {
    const a = await encryptSecret('same-plaintext', key)
    const b = await encryptSecret('same-plaintext', key)
    expect(a).not.toBe(b)
  })

  test('fails to decrypt with the wrong key', async () => {
    const otherKey = crypto.getRandomValues(new Uint8Array(32))
    const blob = await encryptSecret('secret', key)
    await expect(decryptSecret(blob, otherKey)).rejects.toThrow()
  })

  test('rejects a key that is not 32 bytes', async () => {
    const shortKey = crypto.getRandomValues(new Uint8Array(16))
    await expect(encryptSecret('secret', shortKey)).rejects.toThrow(/32 bytes/)
  })

  test('decodeEncryptionKey decodes a base64 32-byte key', () => {
    const encoded = Buffer.from(key).toString('base64')
    expect(decodeEncryptionKey(encoded)).toEqual(key)
  })
})
