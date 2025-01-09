import Role from "./role.helper";
import Roles from "../validators/roles.validator";
import { TokenEntity } from "../entities/users/token.entity";
import { SessionEntity } from "../entities/users/session.entity";
import { UserEntity } from "../entities/users/user.entity";
import { ClsServiceManager } from "nestjs-cls";
import { Authorization } from "../validators/authorization.validator";

export class Auth {
  public static readonly SUPPORTED_ALGOS = [
    'argon2',
    'bcrypt',
    'md5',
    'sha',
    'phpass',
    'scrypt',
    'scryptMod',
    'plaintext'
  ];

  public static readonly DEFAULT_ALGO = 'argon2';
  public static readonly DEFAULT_ALGO_OPTIONS = { type: 'argon2', memoryCost: 2048, timeCost: 4, threads: 3 };

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
  public static unique: string = '';
  public static secret: string = '';

  public static setCookieName(name: string): string {
    return this.cookieName = name;
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

  public static decodeSession(session: string): { id: string | null; secret: string } {
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

  public static passwordHash(string: string, algo: string, options: any = {}): string | null {
    if (algo === 'plaintext') {
      algo = Auth.DEFAULT_ALGO;
      options = Auth.DEFAULT_ALGO_OPTIONS;
    }

    if (!Auth.SUPPORTED_ALGOS.includes(algo)) {
      throw new Error(`Hashing algorithm '${algo}' is not supported.`);
    }

    // Implement hashing logic for each algorithm
    switch (algo) {
      case 'argon2':
        // Implement Argon2 hashing
        break;
      case 'bcrypt':
        // Implement Bcrypt hashing
        break;
      case 'md5':
        return require('crypto').createHash('md5').update(string).digest('hex');
      case 'sha':
        return Auth.hash(string);
      case 'phpass':
        // Implement Phpass hashing
        break;
      case 'scrypt':
        // Implement Scrypt hashing
        break;
      case 'scryptMod':
        // Implement Scrypt modified hashing
        break;
      default:
        throw new Error(`Hashing algorithm '${algo}' is not supported.`);
    }
  }

  public static passwordVerify(plain: string, hash: string, algo: string, options: any = {}): boolean {
    if (algo === 'plaintext') {
      algo = Auth.DEFAULT_ALGO;
      options = Auth.DEFAULT_ALGO_OPTIONS;
    }

    if (!Auth.SUPPORTED_ALGOS.includes(algo)) {
      throw new Error(`Hashing algorithm '${algo}' is not supported.`);
    }

    // Implement verification logic for each algorithm
    switch (algo) {
      case 'argon2':
        // Implement Argon2 verification
        break;
      case 'bcrypt':
        // Implement Bcrypt verification
        break;
      case 'md5':
        return this.hash(plain) === hash;
      case 'sha':
        return this.hash(plain) === hash;
      case 'phpass':
        // Implement Phpass verification
        break;
      case 'scrypt':
        // Implement Scrypt verification
        break;
      case 'scryptMod':
        // Implement Scrypt modified verification
        break;
      default:
        throw new Error(`Hashing algorithm '${algo}' is not supported.`);
    }
  }

  public static passwordGenerator(length: number = 20): string {
    return require('crypto').randomBytes(length).toString('hex').slice(0, length);
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

  public static tokenVerify(tokens: TokenEntity[], type: number | null, secret: string): TokenEntity | false {
    for (const token of tokens) {
      if (
        token.secret !== undefined &&
        token.expire !== undefined &&
        token.type !== undefined &&
        (type === null || token.type === type) &&
        token.secret === this.hash(secret) &&
        new Date(token.expire) >= new Date()
      ) {
        return token;
      }
    }

    return false;
  }

  public static sessionVerify(sessions: SessionEntity[], secret: string): string | false {
    for (const session of sessions) {
      if (
        session.secret !== undefined &&
        session.provider !== undefined &&
        session.secret === this.hash(secret) &&
        new Date(session.expire) >= new Date()
      ) {
        return session.$id;
      }
    }

    return false;
  }

  public static isPrivilegedUser(roles: string[]): boolean {
    return roles.includes(Auth.USER_ROLE_OWNER) ||
      roles.includes(Auth.USER_ROLE_DEVELOPER) ||
      roles.includes(Auth.USER_ROLE_ADMIN);
  }

  public static isAppUser(roles: string[]): boolean {
    return roles.includes(Auth.USER_ROLE_APPS);
  }

  public static getRoles(user: UserEntity): string[] {
    const authorization = ClsServiceManager.getClsService().get('authorization') as Authorization;
    const roles: string[] = [];

    if (!this.isPrivilegedUser(authorization.getRoles()) && !this.isAppUser(authorization.getRoles())) {
      if (user.$id) {
        roles.push(Role.User(user.$id).toString());
        roles.push(Role.Users().toString());

        const emailVerified = user.emailVerification;
        const phoneVerified = user.phoneVerification;

        if (emailVerified || phoneVerified) {
          roles.push(Role.User(user.$id, Roles.DIMENSION_VERIFIED).toString());
          roles.push(Role.Users(Roles.DIMENSION_VERIFIED).toString());
        } else {
          roles.push(Role.User(user.$id, Roles.DIMENSION_UNVERIFIED).toString());
          roles.push(Role.Users(Roles.DIMENSION_UNVERIFIED).toString());
        }
      } else {
        return [Role.Guests().toString()];
      }
    }

    for (const node of (user.memberships || [])) {
      if (!node.confirm) {
        continue;
      }

      if (node.$id && node.teamId) {
        roles.push(Role.Team(node.teamId).toString());
        roles.push(Role.Member(node.$id).toString());

        if (node.roles) {
          for (const nodeRole of node.roles) {
            roles.push(Role.Team(node.teamId, nodeRole).toString());
          }
        }
      }
    }

    for (const label of (user.labels || [])) {
      roles.push(`label:${label}`);
    }

    return roles;
  }

  public static isAnonymousUser(user: UserEntity): boolean {
    return user.email === null && user.phone === null;
  }
}