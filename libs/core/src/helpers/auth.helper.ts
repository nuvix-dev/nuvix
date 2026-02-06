import * as crypto from 'node:crypto'
import { createHash, createHmac, randomBytes, scryptSync } from 'node:crypto'
import { Logger } from '@nestjs/common'
import { Role, UserDimension } from '@nuvix/db'
import {
  configuration,
  HashAlgorithm,
  SessionProvider,
  TokenType,
} from '@nuvix/utils'
import {
  MembershipsDoc,
  SessionsDoc,
  TokensDoc,
  UsersDoc,
} from '@nuvix/utils/types'
import { hash, verify } from 'argon2'
import { Exception } from '../extend/exception'

const algorithm = 'aes-256-cbc'
const key = configuration.security.encryptionKey
  ? Buffer.from(configuration.security.encryptionKey, 'hex')
  : undefined

export enum UserRole {
  ADMIN = 'admin',
  DEVLOPER = 'developer',
  OWNER = 'owner',
  APPS = 'apps',
  SYSTEM = 'system',
  USERS = 'users',
  GUESTS = 'guests',
}

export class Auth {
  private static _isTrustedActor = false
  private static _isPlatformActor = false
  public static readonly SUPPORTED_ALGOS = Object.values(HashAlgorithm)

  public static readonly DEFAULT_ALGO = HashAlgorithm.ARGON2
  public static readonly DEFAULT_ALGO_OPTIONS = {
    type: HashAlgorithm.ARGON2,
    hashLength: 32,
    timeCost: 3,
    memoryCost: 1 << 16,
    parallelism: 4,
  }

  // Token Expiration times
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

  public static cookieName = 'session'
  public static cookieDomain = configuration.server.cookieDomain || ''
  public static cookieSamesite: boolean | 'none' | 'lax' | 'strict' =
    configuration.server.cookieSameSite
  public static unique = ''
  public static secret = ''

  public static setCookieName(name: string): string {
    return (Auth.cookieName = name)
  }

  public static encodeSession(id: string, secret: string): string {
    return Buffer.from(JSON.stringify({ id, secret })).toString('base64')
  }

  public static getSessionProviderByTokenType(
    type: TokenType,
  ): SessionProvider {
    switch (type) {
      case TokenType.VERIFICATION:
      case TokenType.RECOVERY:
      case TokenType.INVITE:
        return SessionProvider.EMAIL
      case TokenType.MAGIC_URL:
        return SessionProvider.MAGIC_URL
      case TokenType.PHONE:
        return SessionProvider.PHONE
      case TokenType.OAUTH2:
        return SessionProvider.OAUTH2
      default:
        return SessionProvider.TOKEN
    }
  }

  public static decodeSession(session: string): {
    id: string | null
    secret: string
  } {
    const bufferStr = Buffer.from(session, 'base64').toString()
    const decoded = JSON.parse(bufferStr)
    const defaultSession = { id: null, secret: '' }

    if (typeof decoded !== 'object' || decoded === null) {
      return defaultSession
    }

    return { ...defaultSession, ...decoded }
  }

  public static hash(string: string): string {
    return crypto.createHash('sha256').update(string).digest('hex')
  }

  /**
   * Hash a string using the specified algorithm.
   */
  public static async passwordHash(
    string: string,
    algo: HashAlgorithm,
    options: any = {},
  ): Promise<string | null> {
    if (algo === HashAlgorithm.PLAINTEXT) {
      algo = Auth.DEFAULT_ALGO
      options = Auth.DEFAULT_ALGO_OPTIONS
    }

    if (!Auth.SUPPORTED_ALGOS.includes(algo)) {
      throw new Error(`Hashing algorithm '${algo}' is not supported.`)
    }

    switch (algo) {
      case HashAlgorithm.ARGON2: {
        const aOptions =
          Object.keys(options).length === 0
            ? undefined
            : {
                hashLength: options.hashLength,
                timeCost: options.timeCost,
                memoryCost: options.memoryCost,
                parallelism: options.parallelism,
              }
        return hash(string, { raw: false, ...aOptions })
      }
      case HashAlgorithm.BCRYPT: {
        const saltRounds = options.saltRounds || 10
        return (await Auth.getBcrypt()).hash(string, saltRounds)
      }
      case HashAlgorithm.MD5:
        return createHash('md5').update(string).digest('hex')

      case HashAlgorithm.SHA:
        return createHash('sha256').update(string).digest('hex')

      case HashAlgorithm.PHPASS: {
        // Basic phpass implementation (insecure, for legacy systems only)
        const salt = options.salt || randomBytes(6).toString('base64')
        return createHmac('sha1', salt).update(string).digest('base64')
      }
      case HashAlgorithm.SCRYPT: {
        const scryptSalt = options.salt || randomBytes(16)
        const scryptOptions = { N: 16384, r: 8, p: 1, ...options }
        return scryptSync(string, scryptSalt, 64, scryptOptions).toString('hex')
      }

      case HashAlgorithm.SCRYPT_MOD: {
        const modSalt = options.salt || randomBytes(16)
        return createHmac('sha256', modSalt).update(string).digest('hex')
      }

      default:
        throw new Error(`Hashing algorithm '${algo}' is not supported.`)
    }
  }

  /**
   * Verify if a plain string matches a hashed value using the specified algorithm.
   */
  public static async passwordVerify(
    plain: string,
    hash: string,
    algo: HashAlgorithm,
    options: any = {},
  ): Promise<boolean> {
    if (algo === HashAlgorithm.PLAINTEXT) {
      algo = Auth.DEFAULT_ALGO
      options = Auth.DEFAULT_ALGO_OPTIONS
    }

    if (!Auth.SUPPORTED_ALGOS.includes(algo)) {
      throw new Error(`Hashing algorithm '${algo}' is not supported.`)
    }

    switch (algo) {
      case HashAlgorithm.ARGON2:
        return verify(hash, plain, { ...options })

      case HashAlgorithm.BCRYPT:
        return (await Auth.getBcrypt()).compare(plain, hash)

      case HashAlgorithm.MD5:
      case HashAlgorithm.SHA: {
        const generatedHash = await Auth.passwordHash(plain, algo, options)
        return generatedHash === hash
      }

      case HashAlgorithm.PHPASS: {
        // TODO: recheck or remove
        const salt = hash.slice(0, 6)
        return createHmac('sha1', salt).update(plain).digest('base64') === hash
      }

      case HashAlgorithm.SCRYPT:
      case HashAlgorithm.SCRYPT_MOD: {
        const scryptGeneratedHash = await Auth.passwordHash(
          plain,
          algo,
          options,
        )
        return scryptGeneratedHash === hash
      }

      default:
        throw new Error(`Hashing algorithm '${algo}' is not supported.`)
    }
  }

  public static passwordGenerator(length = 20): string {
    return crypto.randomBytes(length).toString('hex')
  }

  public static tokenGenerator(length = 256): string {
    if (length <= 0) {
      throw new Error('Token length must be greater than 0')
    }

    const bytesLength = Math.ceil(length / 2)
    const token = crypto.randomBytes(bytesLength).toString('hex')

    return token.slice(0, length)
  }

  public static codeGenerator(length = 6): string {
    // TODO: we have to use another better & secure approch e.g. crypto
    let value = ''

    for (let i = 0; i < length; i++) {
      value += Math.floor(Math.random() * 10).toString()
    }

    return value
  }

  public static tokenVerify(
    tokens: TokensDoc[],
    type: TokenType | null,
    secret: string,
  ): TokensDoc | false {
    for (const token of tokens) {
      if (
        token.get('secret') !== null &&
        token.get('expire') !== null &&
        token.get('type') !== null &&
        (type === null || token.get('type') === type) &&
        token.get('secret') === Auth.hash(secret) &&
        new Date(token.get('expire') as string).getTime() >= Date.now()
      ) {
        return token
      }
    }

    return false
  }

  public static sessionVerify(
    sessions: SessionsDoc[],
    secret: string,
  ): string | false {
    for (const session of sessions) {
      if (
        session.get('secret') !== null &&
        session.get('expire') !== null &&
        session.get('provider') !== null &&
        session.get('secret') === Auth.hash(secret) &&
        new Date(session.get('expire') as string).getTime() >= Date.now()
      ) {
        return session.getId()
      }
    }

    return false
  }

  // Trusted Actor (e.g. internal services) can bypass certain checks
  public static get isTrustedActor(): boolean {
    return Auth._isTrustedActor
  }

  // Platform Actor (e.g. platform level services) can bypass certain checks
  public static get isPlatformActor(): boolean {
    return Auth._isPlatformActor
  }

  public static setTrustedActor(value: boolean) {
    Auth._isTrustedActor = value
  }

  public static setPlatformActor(value: boolean) {
    Auth._isPlatformActor = value
  }

  public static getRoles(user: UsersDoc): string[] {
    const roles: string[] = []

    if (!Auth.isPlatformActor && !Auth.isTrustedActor) {
      if (user.getId()) {
        roles.push(Role.user(user.getId()).toString())
        roles.push(Role.users().toString())

        const emailVerified = user.get('emailVerification', false)
        const phoneVerified = user.get('phoneVerification', false)

        if (emailVerified || phoneVerified) {
          roles.push(Role.user(user.getId(), UserDimension.VERIFIED).toString())
          roles.push(Role.users(UserDimension.VERIFIED).toString())
        } else {
          roles.push(
            Role.user(user.getId(), UserDimension.UNVERIFIED).toString(),
          )
          roles.push(Role.users(UserDimension.UNVERIFIED).toString())
        }
      } else {
        return [Role.guests().toString()]
      }
    }

    for (const node of (user.get('memberships') || []) as MembershipsDoc[]) {
      if (!node.get('confirm')) {
        continue
      }

      if (node.getId() && node.get('teamId')) {
        roles.push(Role.team(node.get('teamId')).toString())
        roles.push(Role.member(node.getId()).toString())

        if (node.get('roles')) {
          for (const nodeRole of node.get('roles')) {
            roles.push(Role.team(node.get('teamId'), nodeRole).toString())
          }
        }
      }
    }

    for (const label of user.get('labels', [])) {
      roles.push(`label:${label}`)
    }

    return roles
  }

  public static isAnonymousUser(user: UsersDoc): boolean {
    return user.get('email') === null && user.get('phone') === null
  }

  private static async getBcrypt() {
    try {
      const bcrypt = await import('bcrypt')
      return bcrypt
    } catch (error) {
      Logger.warn(error)
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'bcrypt is not available on the server.',
      )
    }
  }

  static encrypt(text: string): string {
    if (!key) {
      throw Error(
        'NUVIX_ENCRYPTION_KEY is required, make sure you have added in current environment.',
      )
    }
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`
  }

  static decrypt(text: string): string {
    if (!key) {
      throw Error(
        'NUVIX_ENCRYPTION_KEY is required, make sure you have added in current environment.',
      )
    }
    const textParts = text.split(':')
    const iv = Buffer.from(textParts.shift() as string, 'hex')
    const encryptedText = Buffer.from(textParts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
  }
}
