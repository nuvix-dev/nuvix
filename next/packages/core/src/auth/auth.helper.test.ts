import { describe, expect, test } from 'bun:test'
import { Doc, Role, UserDimension } from '@nuvix/db'
import { Auth, HashAlgorithm, validatePasswordHistory, validatePersonalData } from './auth.helper'

describe('Auth helper', () => {
  test('hashes and verifies password using Argon2id', async () => {
    const password = 'my-secret-password'
    const hash = await Auth.passwordHash(password, HashAlgorithm.ARGON2ID)
    expect(hash).toContain('$argon2id$')

    const valid = await Auth.passwordVerify(password, hash, HashAlgorithm.ARGON2ID)
    expect(valid).toBe(true)

    const invalid = await Auth.passwordVerify('wrong-password', hash, HashAlgorithm.ARGON2ID)
    expect(invalid).toBe(false)
  })

  test('hashes and verifies password using Bcrypt', async () => {
    const password = 'bcrypt-password'
    const hash = await Auth.passwordHash(password, HashAlgorithm.BCRYPT)
    expect(hash.startsWith('$2')).toBe(true)

    const valid = await Auth.passwordVerify(password, hash, HashAlgorithm.BCRYPT)
    expect(valid).toBe(true)

    const invalid = await Auth.passwordVerify('wrong-password', hash, HashAlgorithm.BCRYPT)
    expect(invalid).toBe(false)
  })

  test('safeCompare correctly compares strings in constant time', () => {
    expect(Auth.safeCompare('hello', 'hello')).toBe(true)
    expect(Auth.safeCompare('hello', 'world')).toBe(false)
    expect(Auth.safeCompare('hello', 'hell')).toBe(false)
    expect(Auth.safeCompare(null, 'hello')).toBe(false)
  })

  test('generators produce correct lengths', () => {
    expect(Auth.passwordGenerator(16).length).toBe(32) // 16 bytes = 32 hex chars
    expect(Auth.tokenGenerator(64).length).toBe(64)
    expect(Auth.codeGenerator(6).length).toBe(6)
  })

  test('sessionVerify validates unexpired session secret', () => {
    const secret = 'raw-session-secret'
    const hashed = Auth.hash(secret)
    const futureDate = new Date(Date.now() + 3600_000).toISOString()
    const pastDate = new Date(Date.now() - 3600_000).toISOString()

    const validSession = new Doc({
      $id: 'sess_valid',
      secret: hashed,
      expire: futureDate,
    })
    const expiredSession = new Doc({
      $id: 'sess_expired',
      secret: hashed,
      expire: pastDate,
    })

    expect(Auth.sessionVerify([validSession], secret)).toBe('sess_valid')
    expect(Auth.sessionVerify([expiredSession], secret)).toBe(false)
    expect(Auth.sessionVerify([validSession], 'wrong-secret')).toBe(false)
  })

  test('tokenVerify validates unexpired token secret and type', () => {
    const secret = 'raw-token-secret'
    const hashed = Auth.hash(secret)
    const futureDate = new Date(Date.now() + 3600_000).toISOString()

    const token = new Doc({
      $id: 'tok_1',
      type: 1,
      secret: hashed,
      expire: futureDate,
    })

    expect(Auth.tokenVerify([token], 1, secret)).toBe(token)
    expect(Auth.tokenVerify([token], 2, secret)).toBe(false)
    expect(Auth.tokenVerify([token], 1, 'wrong')).toBe(false)
  })

  test('getRoles calculates canonical roles for guest and user', () => {
    expect(Auth.getRoles(null)).toEqual([Role.guests().toString()])

    const user = new Doc({
      $id: 'usr_123',
      emailVerification: true,
      phoneVerification: false,
      labels: ['premium', 'beta'],
      memberships: [
        new Doc({
          $id: 'mbr_1',
          teamId: 'team_abc',
          confirm: true,
          roles: ['admin'],
        }),
      ],
    })

    const roles = Auth.getRoles(user)
    expect(roles).toContain(Role.user('usr_123').toString())
    expect(roles).toContain(Role.users().toString())
    expect(roles).toContain(Role.user('usr_123', UserDimension.VERIFIED).toString())
    expect(roles).toContain(Role.users(UserDimension.VERIFIED).toString())
    expect(roles).toContain(Role.team('team_abc').toString())
    expect(roles).toContain(Role.member('mbr_1').toString())
    expect(roles).toContain(Role.team('team_abc', 'admin').toString())
    expect(roles).toContain('label:premium')
    expect(roles).toContain('label:beta')
  })

  test('validatePersonalData detects user personal information in password', () => {
    const data = {
      userId: 'user123',
      email: 'john.doe@example.com',
      name: 'John Doe',
      phone: '+1234567890',
    }

    expect(validatePersonalData('SafePassword!2026', data)).toBe(true)
    expect(validatePersonalData('PassUser123Word', data)).toBe(false)
    expect(validatePersonalData('Passjohn.doeWord', data)).toBe(false)
    expect(validatePersonalData('PassJohnWord', data)).toBe(false)
    expect(validatePersonalData('Pass1234567890Word', data)).toBe(false)
  })

  test('validatePasswordHistory rejects passwords present in history', async () => {
    const password = 'my-old-password'
    const hash = await Auth.passwordHash(password, HashAlgorithm.ARGON2ID)

    expect(await validatePasswordHistory(password, [hash], HashAlgorithm.ARGON2ID)).toBe(false)
    expect(
      await validatePasswordHistory('brand-new-password', [hash], HashAlgorithm.ARGON2ID),
    ).toBe(true)
  })
})
