import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { type Doc, type IEntity, Role, UserDimension } from '@nuvix/db'
import { hash as argon2Hash, verify as argon2Verify } from 'argon2'
import * as bcrypt from 'bcrypt'
import { decryptSecret, encryptSecret } from '../tenants/encryption'

export enum HashAlgorithm {
  ARGON2 = 'argon2',
  ARGON2ID = 'argon2id',
  BCRYPT = 'bcrypt',
}

export interface Argon2Options {
  hashLength?: number
  timeCost?: number
  memoryCost?: number
  parallelism?: number
}

export interface BcryptOptions {
  saltRounds?: number
}

// biome-ignore lint/complexity/noStaticOnlyClass: matches legacy Auth helper class API
export class Auth {
  public static readonly DEFAULT_ALGO = HashAlgorithm.ARGON2ID
  public static readonly DEFAULT_ALGO_OPTIONS: Argon2Options = {
    hashLength: 32,
    timeCost: 3,
    memoryCost: 1 << 16,
    parallelism: 4,
  }

  // Token Expiration times (seconds)
  public static readonly TOKEN_EXPIRATION_LOGIN_LONG = 31536000 // 1 year
  public static readonly TOKEN_EXPIRATION_LOGIN_SHORT = 3600 // 1 hour
  public static readonly TOKEN_EXPIRATION_RECOVERY = 3600 // 1 hour
  public static readonly TOKEN_EXPIRATION_CONFIRM = 3600 // 1 hour
  public static readonly TOKEN_EXPIRATION_OTP = 60 * 15 // 15 minutes
  public static readonly TOKEN_EXPIRATION_GENERIC = 60 * 15 // 15 minutes

  // Token Lengths
  public static readonly TOKEN_LENGTH_MAGIC_URL = 64
  public static readonly TOKEN_LENGTH_VERIFICATION = 256
  public static readonly TOKEN_LENGTH_RECOVERY = 256
  public static readonly TOKEN_LENGTH_OAUTH2 = 64
  public static readonly TOKEN_LENGTH_SESSION = 256

  // MFA
  public static readonly MFA_RECENT_DURATION = 1800 // 30 mins

  /**
   * SHA-256 hash for secrets, tokens, and session secrets (constant-length storage).
   */
  public static hash(string: string): string {
    return createHash('sha256').update(string).digest('hex')
  }

  /**
   * Hash password using Argon2 or Bcrypt.
   */
  public static async passwordHash(
    plain: string,
    algo: HashAlgorithm = Auth.DEFAULT_ALGO,
    options: Argon2Options | BcryptOptions = Auth.DEFAULT_ALGO_OPTIONS,
  ): Promise<string> {
    switch (algo) {
      case HashAlgorithm.ARGON2:
      case HashAlgorithm.ARGON2ID: {
        const opts = options as Argon2Options
        return argon2Hash(plain, {
          raw: false,
          hashLength: opts.hashLength,
          timeCost: opts.timeCost,
          memoryCost: opts.memoryCost,
          parallelism: opts.parallelism,
        })
      }
      case HashAlgorithm.BCRYPT: {
        const opts = options as BcryptOptions
        const saltRounds = opts.saltRounds || 10
        return bcrypt.hash(plain, saltRounds)
      }
      default:
        throw new Error(`Hashing algorithm '${algo}' is not supported.`)
    }
  }

  /**
   * Verify password against hashed value.
   */
  public static async passwordVerify(
    plain: string,
    hash: string,
    algo: HashAlgorithm = Auth.DEFAULT_ALGO,
  ): Promise<boolean> {
    if (!plain || !hash) return false

    switch (algo) {
      case HashAlgorithm.ARGON2:
      case HashAlgorithm.ARGON2ID: {
        try {
          return await argon2Verify(hash, plain)
        } catch {
          return false
        }
      }
      case HashAlgorithm.BCRYPT: {
        try {
          return await bcrypt.compare(plain, hash)
        } catch {
          return false
        }
      }
      default:
        throw new Error(`Hashing algorithm '${algo}' is not supported.`)
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   */
  public static safeCompare(a: unknown, b: unknown): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false
    }

    const bufA = Buffer.from(a, 'utf-8')
    const bufB = Buffer.from(b, 'utf-8')
    if (bufA.length !== bufB.length) {
      return false
    }
    return timingSafeEqual(bufA, bufB)
  }

  public static passwordGenerator(length = 20): string {
    return randomBytes(length).toString('hex')
  }

  public static tokenGenerator(length = 256): string {
    if (length <= 0) {
      throw new Error('Token length must be greater than 0')
    }
    const bytesLength = Math.ceil(length / 2)
    return randomBytes(bytesLength).toString('hex').slice(0, length)
  }

  public static codeGenerator(length = 6): string {
    let value = ''
    for (let i = 0; i < length; i++) {
      value += randomInt(0, 10).toString()
    }
    return value
  }

  public static async encodeSession(id: string, secret: string, key: Uint8Array): Promise<string> {
    const sessionData = JSON.stringify({ id, secret })
    return encryptSecret(sessionData, key)
  }

  public static async decodeSession(
    session: string,
    key?: Uint8Array,
  ): Promise<{ id?: string; secret?: string }> {
    const defaultSession = { id: undefined, secret: undefined }
    try {
      if (key) {
        try {
          const decrypted = await decryptSecret(session, key)
          const decoded = JSON.parse(decrypted)
          if (typeof decoded === 'object' && decoded !== null) {
            return { ...defaultSession, ...decoded }
          }
        } catch {
          // Fall through to base64
        }
      }
      const bufferStr = Buffer.from(session, 'base64').toString('utf-8')
      const decoded = JSON.parse(bufferStr)
      if (typeof decoded === 'object' && decoded !== null) {
        return { ...defaultSession, ...decoded }
      }
      return defaultSession
    } catch {
      return defaultSession
    }
  }

  public static sessionVerify<T extends Partial<IEntity> = Partial<IEntity>>(
    sessions: Doc<T>[],
    secret?: string,
  ): string | false {
    if (!secret) return false

    const hashedSecret = Auth.hash(secret)
    for (const session of sessions) {
      const sessionSecret = session.get('secret')
      const expire = session.get('expire')
      if (
        sessionSecret &&
        expire &&
        Auth.safeCompare(sessionSecret, hashedSecret) &&
        new Date(expire as string).getTime() >= Date.now()
      ) {
        return session.getId()
      }
    }

    return false
  }

  public static tokenVerify<T extends Partial<IEntity> = Partial<IEntity>>(
    tokens: Doc<T>[],
    type: number | string | null,
    secret: string,
  ): Doc<T> | false {
    const hashedSecret = Auth.hash(secret)
    for (const token of tokens) {
      const tokenSecret = token.get('secret')
      const expire = token.get('expire')
      const tokenType = token.get('type')
      if (
        tokenSecret &&
        expire &&
        (type === null || tokenType === type) &&
        Auth.safeCompare(tokenSecret, hashedSecret) &&
        new Date(expire as string).getTime() >= Date.now()
      ) {
        return token
      }
    }

    return false
  }

  /**
   * Compute caller canonical roles 1:1 with legacy Auth.getRoles.
   */
  public static getRoles<T extends Partial<IEntity> = Partial<IEntity>>(
    user?: Doc<T> | null,
    isAdmin?: boolean,
    isAPIUser?: boolean,
  ): string[] {
    const roles: string[] = []

    if (!user?.getId()) {
      return [Role.guests().toString()]
    }

    const userId = user.getId()
    roles.push(Role.user(userId).toString())
    roles.push(Role.users().toString())

    const emailVerified = Boolean(user.get('emailVerification', false))
    const phoneVerified = Boolean(user.get('phoneVerification', false))

    if (emailVerified || phoneVerified) {
      roles.push(Role.user(userId, UserDimension.VERIFIED).toString())
      roles.push(Role.users(UserDimension.VERIFIED).toString())
    } else {
      roles.push(Role.user(userId, UserDimension.UNVERIFIED).toString())
      roles.push(Role.users(UserDimension.UNVERIFIED).toString())
    }

    // Memberships
    const memberships = (user.get('memberships') || []) as Doc<Partial<IEntity>>[]
    for (const node of memberships) {
      if (!node.get('confirm')) continue

      const teamId = node.get('teamId') as string
      const memberId = node.getId()
      if (memberId && teamId) {
        roles.push(Role.team(teamId).toString())
        roles.push(Role.member(memberId).toString())

        const memberRoles = (node.get('roles') || []) as string[]
        for (const nodeRole of memberRoles) {
          roles.push(Role.team(teamId, nodeRole).toString())
        }
      }
    }

    // Labels
    const labels = (user.get('labels') || []) as string[]
    for (const label of labels) {
      roles.push(`label:${label}`)
    }

    if (isAdmin) {
      roles.push('admin')
      roles.push('role:admin')
    }
    if (isAPIUser) {
      roles.push('key')
      roles.push('role:key')
    }

    return roles
  }

  public static isAnonymousUser<T extends Partial<IEntity> = Partial<IEntity>>(
    user: Doc<T>,
  ): boolean {
    return user.get('email') === null && user.get('phone') === null
  }
}

export async function hashPassword(
  password: string,
  options: { algorithm?: 'argon2' | 'argon2id' | 'bcrypt' } = {},
): Promise<string> {
  const algo = options.algorithm === 'bcrypt' ? HashAlgorithm.BCRYPT : HashAlgorithm.ARGON2ID
  return Auth.passwordHash(password, algo)
}

export async function verifyPassword(
  password: string,
  hash: string,
  algorithm: 'argon2' | 'argon2id' | 'bcrypt' = 'argon2id',
): Promise<boolean> {
  const algo = algorithm === 'bcrypt' ? HashAlgorithm.BCRYPT : HashAlgorithm.ARGON2ID
  return Auth.passwordVerify(password, hash, algo)
}
