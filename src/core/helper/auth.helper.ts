import * as crypto from 'crypto';
import { createHash, randomBytes, createHmac, scryptSync } from 'crypto';
import { Exception } from '../extend/exception';
import { ENCRYPTION_KEY } from 'src/Utils/constants';
import { Authorization, Document, Roles, Role } from '@nuvix/database';

const algorithm = 'aes-256-cbc';
const key = ENCRYPTION_KEY ? Buffer.from(ENCRYPTION_KEY, 'hex') : undefined;

export class Auth {
  public static readonly SUPPORTED_ALGOS = [
    'argon2',
    'bcrypt',
    'md5',
    'sha',
    'phpass',
    'scrypt',
    'scryptMod',
    'plaintext',
  ];

  // public static readonly DEFAULT_ALGO = 'argon2';
  // public static readonly DEFAULT_ALGO_OPTIONS = { type: 'argon2', memoryCost: 2048, timeCost: 4, threads: 3 };
  public static readonly DEFAULT_ALGO = 'bcrypt';
  public static readonly DEFAULT_ALGO_OPTIONS = { saltRounds: 10 };

  // User Roles
  public static readonly USER_ROLE_ANY = 'any';
  public static readonly USER_ROLE_GUESTS = 'guests';
  public static readonly USER_ROLE_USERS = 'users';
  public static readonly USER_ROLE_ADMIN = 'admin';
  public static readonly USER_ROLE_DEVELOPER = 'developer';
  public static readonly USER_ROLE_OWNER = 'owner';
  public static readonly USER_ROLE_APPS = 'apps';
  public static readonly USER_ROLE_SYSTEM = 'system';

  // Token Types
  public static readonly TOKEN_TYPE_VERIFICATION = 2;
  public static readonly TOKEN_TYPE_RECOVERY = 3;
  public static readonly TOKEN_TYPE_INVITE = 4;
  public static readonly TOKEN_TYPE_MAGIC_URL = 5;
  public static readonly TOKEN_TYPE_PHONE = 6;
  public static readonly TOKEN_TYPE_OAUTH2 = 7;
  public static readonly TOKEN_TYPE_GENERIC = 8;
  public static readonly TOKEN_TYPE_EMAIL = 9; // OTP

  // Session Providers
  public static readonly SESSION_PROVIDER_EMAIL = 'email';
  public static readonly SESSION_PROVIDER_ANONYMOUS = 'anonymous';
  public static readonly SESSION_PROVIDER_MAGIC_URL = 'magic-url';
  public static readonly SESSION_PROVIDER_PHONE = 'phone';
  public static readonly SESSION_PROVIDER_OAUTH2 = 'oauth2';
  public static readonly SESSION_PROVIDER_TOKEN = 'token';
  public static readonly SESSION_PROVIDER_SERVER = 'server';

  // Token Expiration times
  public static readonly TOKEN_EXPIRATION_LOGIN_LONG = 31536000; // 1 year
  public static readonly TOKEN_EXPIRATION_LOGIN_SHORT = 3600; // 1 hour
  public static readonly TOKEN_EXPIRATION_RECOVERY = 3600; // 1 hour
  public static readonly TOKEN_EXPIRATION_CONFIRM = 3600; // 1 hour
  public static readonly TOKEN_EXPIRATION_OTP = 60 * 15; // 15 minutes
  public static readonly TOKEN_EXPIRATION_GENERIC = 60 * 15; // 15 minutes

  // Token Lengths
  public static readonly TOKEN_LENGTH_MAGIC_URL = 64;
  public static readonly TOKEN_LENGTH_VERIFICATION = 256;
  public static readonly TOKEN_LENGTH_RECOVERY = 256;
  public static readonly TOKEN_LENGTH_OAUTH2 = 64;
  public static readonly TOKEN_LENGTH_SESSION = 256;

  // MFA
  public static readonly MFA_RECENT_DURATION = 1800; // 30 mins

  public static cookieName: string = 'a_session';
  public static cookieDomain = '';
  public static cookieSamesite = 'none';
  public static unique: string = '';
  public static secret: string = '';

  public static setCookieName(name: string): string {
    return (this.cookieName = name);
  }

  public static encodeSession(id: string, secret: string): string {
    return Buffer.from(JSON.stringify({ id, secret })).toString('base64');
  }

  public static getSessionProviderByTokenType(type: number): string {
    switch (type) {
      case Auth.TOKEN_TYPE_VERIFICATION:
      case Auth.TOKEN_TYPE_RECOVERY:
      case Auth.TOKEN_TYPE_INVITE:
        return Auth.SESSION_PROVIDER_EMAIL;
      case Auth.TOKEN_TYPE_MAGIC_URL:
        return Auth.SESSION_PROVIDER_MAGIC_URL;
      case Auth.TOKEN_TYPE_PHONE:
        return Auth.SESSION_PROVIDER_PHONE;
      case Auth.TOKEN_TYPE_OAUTH2:
        return Auth.SESSION_PROVIDER_OAUTH2;
      default:
        return Auth.SESSION_PROVIDER_TOKEN;
    }
  }

  public static decodeSession(session: string): {
    id: string | null;
    secret: string;
  } {
    const decoded = JSON.parse(Buffer.from(session, 'base64').toString());
    const defaultSession = { id: null, secret: '' };

    if (typeof decoded !== 'object' || decoded === null) {
      return defaultSession;
    }

    return { ...defaultSession, ...decoded };
  }

  public static hash(string: string): string {
    return require('crypto').createHash('sha256').update(string).digest('hex');
  }

  /**
   * Hash a string using the specified algorithm.
   */
  public static async passwordHash(
    string: string,
    algo: string,
    options: any = {},
  ): Promise<string | null> {
    if (algo === 'plaintext') {
      algo = Auth.DEFAULT_ALGO;
      options = Auth.DEFAULT_ALGO_OPTIONS;
    }

    if (!Auth.SUPPORTED_ALGOS.includes(algo)) {
      throw new Error(`Hashing algorithm '${algo}' is not supported.`);
    }

    switch (algo) {
      case 'argon2':
        return (await this.getArgon2().hash(string, { ...options })).toString(
          'hex',
        );

      case 'bcrypt':
        const saltRounds = options.saltRounds || 10;
        return await this.getBcrypt().hash(string, saltRounds);
      case 'md5':
        return createHash('md5').update(string).digest('hex');

      case 'sha':
        return createHash('sha256').update(string).digest('hex');

      case 'phpass':
        // Basic phpass implementation (insecure, for legacy systems only)
        const salt = options.salt || randomBytes(6).toString('base64');
        return createHmac('sha1', salt).update(string).digest('base64');
      case 'scrypt':
        const scryptSalt = options.salt || randomBytes(16);
        const scryptOptions = { N: 16384, r: 8, p: 1, ...options };
        return scryptSync(string, scryptSalt, 64, scryptOptions).toString(
          'hex',
        );

      case 'scryptMod':
        const modSalt = options.salt || randomBytes(16);
        return createHmac('sha256', modSalt).update(string).digest('hex');

      default:
        throw new Error(`Hashing algorithm '${algo}' is not supported.`);
    }
  }

  /**
   * Verify if a plain string matches a hashed value using the specified algorithm.
   */
  public static async passwordVerify(
    plain: string,
    hash: string,
    algo: string,
    options: any = {},
  ): Promise<boolean> {
    if (algo === 'plaintext') {
      algo = Auth.DEFAULT_ALGO;
      options = Auth.DEFAULT_ALGO_OPTIONS;
    }

    if (!Auth.SUPPORTED_ALGOS.includes(algo)) {
      throw new Error(`Hashing algorithm '${algo}' is not supported.`);
    }

    switch (algo) {
      case 'argon2':
        return await this.getArgon2().verify(hash, plain, { ...options });

      case 'bcrypt':
        return await this.getBcrypt().compare(plain, hash);

      case 'md5':
      case 'sha':
        const generatedHash = await this.passwordHash(plain, algo, options);
        return generatedHash === hash;

      case 'phpass':
        const salt = hash.slice(0, 6); // Assuming the first 6 characters are the salt
        return createHmac('sha1', salt).update(plain).digest('base64') === hash;

      case 'scrypt':
      case 'scryptMod':
        const scryptGeneratedHash = await this.passwordHash(
          plain,
          algo,
          options,
        );
        return scryptGeneratedHash === hash;

      default:
        throw new Error(`Hashing algorithm '${algo}' is not supported.`);
    }
  }

  public static passwordGenerator(length: number = 20): string {
    return require('crypto')
      .randomBytes(length)
      .toString('hex')
      .slice(0, length);
  }

  public static tokenGenerator(length: number = 256): string {
    if (length <= 0) {
      throw new Error('Token length must be greater than 0');
    }

    const bytesLength = Math.ceil(length / 2);
    const token = require('crypto').randomBytes(bytesLength).toString('hex');

    return token.slice(0, length);
  }

  public static codeGenerator(length: number = 6): string {
    let value = '';

    for (let i = 0; i < length; i++) {
      value += Math.floor(Math.random() * 10).toString();
    }

    return value;
  }

  public static tokenVerify(
    tokens: Document[],
    type: number | null,
    secret: string,
  ): Document | false {
    for (const token of tokens) {
      if (
        token.getAttribute('secret') !== null &&
        token.getAttribute('expire') !== null &&
        token.getAttribute('type') !== null &&
        (type === null || token.getAttribute('type') === type) &&
        token.getAttribute('secret') === this.hash(secret) &&
        new Date(token.getAttribute('expire')) >= new Date()
      ) {
        return token;
      }
    }

    return false;
  }

  public static sessionVerify(
    sessions: Document[],
    secret: string,
  ): string | false {
    for (const session of sessions) {
      if (
        session.getAttribute('secret') !== null &&
        session.getAttribute('expire') !== null &&
        session.getAttribute('provider') !== null &&
        session.getAttribute('secret') === this.hash(secret) &&
        new Date(session.getAttribute('expire')) >= new Date()
      ) {
        return session.getId();
      }
    }

    return false;
  }

  public static isPrivilegedUser(roles: string[]): boolean {
    return (
      roles.includes(Auth.USER_ROLE_OWNER) ||
      roles.includes(Auth.USER_ROLE_DEVELOPER) ||
      roles.includes(Auth.USER_ROLE_ADMIN)
    );
  }

  public static isAppUser(roles: string[]): boolean {
    return roles.includes(Auth.USER_ROLE_APPS);
  }

  public static getRoles(user: Document): string[] {
    const roles: string[] = [];

    if (
      !this.isPrivilegedUser(Authorization.getRoles()) &&
      !this.isAppUser(Authorization.getRoles())
    ) {
      if (user.getId()) {
        roles.push(Role.user(user.getId()).toString());
        roles.push(Role.users().toString());

        const emailVerified = user.getAttribute('emailVerification');
        const phoneVerified = user.getAttribute('phoneVerification');

        if (emailVerified || phoneVerified) {
          roles.push(
            Role.user(user.getId(), Roles.DIMENSION_VERIFIED).toString(),
          );
          roles.push(Role.users(Roles.DIMENSION_VERIFIED).toString());
        } else {
          roles.push(
            Role.user(user.getId(), Roles.DIMENSION_UNVERIFIED).toString(),
          );
          roles.push(Role.users(Roles.DIMENSION_UNVERIFIED).toString());
        }
      } else {
        return [Role.guests().toString()];
      }
    }

    for (const node of user.getAttribute('memberships') || []) {
      if (!node.getAttribute('confirm')) {
        continue;
      }

      if (node.getAttribute('$id') && node.getAttribute('teamId')) {
        roles.push(Role.team(node.getAttribute('teamId')).toString());
        roles.push(Role.member(node.getId()).toString());

        if (node.getAttribute('roles')) {
          for (const nodeRole of node.getAttribute('roles')) {
            roles.push(
              Role.team(node.getAttribute('teamId'), nodeRole).toString(),
            );
          }
        }
      }
    }

    for (const label of user.getAttribute('labels') || []) {
      roles.push(`label:${label}`);
    }

    return roles;
  }

  public static isAnonymousUser(user: Document): boolean {
    return (
      user.getAttribute('email') === null && user.getAttribute('phone') === null
    );
  }

  private static getBcrypt(): any {
    try {
      // Try to load native bcrypt and check if it is supported
      let bcrypt = require('bcrypt');
      bcrypt.hashSync('test', 10); // Test if native bcrypt is working
      console.log('Using native bcrypt.');
      return bcrypt;
    } catch (error) {
      console.warn('Native bcrypt not available, falling back to bcryptjs.');
      return require('bcryptjs'); // Fallback to bcryptjs if native bcrypt fails
    }
  }

  private static getArgon2() {
    try {
      let argon2 = require('argon2');
      return argon2;
    } catch (e) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Argon2 library is not available on the server.',
      );
    }
  }

  static encrypt(text: string): string {
    if (!key)
      throw Error(
        'ENCRYPTION_KEY is required, make sure you have added in current environment.',
      );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  static decrypt(text: string): string {
    if (!key)
      throw Error(
        'ENCRYPTION_KEY is required, make sure you have added in current environment.',
      );
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
}
