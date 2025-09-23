import { Injectable, Logger } from '@nestjs/common';
import { Exception } from '@nuvix/core/extend/exception';
import { ID } from '@nuvix/core/helper/ID.helper';
import { PersonalDataValidator } from '@nuvix/core/validators/personal-data.validator';
import {
  CreateUserDTO,
  CreateUserWithScryptDTO,
  CreateUserWithScryptModifedDTO,
  CreateUserWithShaDTO,
  UpdateUserEmailVerificationDTO,
  UpdateUserLabelDTO,
  UpdateUserNameDTO,
  UpdateUserPasswordDTO,
  UpdateUserPoneVerificationDTO,
  UpdateUserStatusDTO,
} from './DTO/user.dto';
import {
  configuration,
  HashAlgorithm,
  MetricFor,
  MetricPeriod,
  TokenType,
} from '@nuvix/utils';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { PasswordHistoryValidator } from '@nuvix/core/validators/password-history.validator';
import { Detector } from '@nuvix/core/helper/detector.helper';

import { CreateTokenDTO } from './DTO/token.dto';
import { CreateJwtDTO } from './DTO/jwt.dto';
import { JwtService } from '@nestjs/jwt';
import {
  Authorization,
  Database,
  Doc,
  DuplicateException,
  Permission,
  Query,
  Role,
} from '@nuvix/db';
import { CountryResponse, Reader } from 'maxmind';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoreService } from '@nuvix/core';
import type {
  MembershipsDoc,
  ProjectsDoc,
  SessionsDoc,
  TargetsDoc,
  Tokens,
  Users,
  UsersDoc,
} from '@nuvix/utils/types';
import { Audit } from '@nuvix/audit';
import type { LocaleTranslator } from '@nuvix/core/helper';
import usageConfig from '@nuvix/core/config/usage';
import { StatsQueue } from '@nuvix/core/resolvers';

@Injectable()
export class UsersService {
  private logger: Logger = new Logger(UsersService.name);
  private readonly geoDb: Reader<CountryResponse>;

  constructor(
    private readonly coreService: CoreService,
    private readonly jwtService: JwtService,
    private readonly event: EventEmitter2,
  ) {
    this.geoDb = this.coreService.getGeoDb();
  }

  /**
   * Find all users
   */
  async findAll(db: Database, queries: Query[] = [], search?: string) {
    if (search) {
      queries.push(Query.search('search', search));
    }
    const filterQueries = Query.groupByType(queries)['filters'];

    return {
      users: await db.find('users', queries),
      total: await db.count(
        'users',
        filterQueries,
        configuration.limits.limitCount,
      ),
    };
  }

  /**
   * Find a user by id
   */
  async findOne(db: Database, id: string) {
    const user = await db.getDocument('users', id);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    return user;
  }

  /**
   * Get user preferences
   */
  async getPrefs(db: Database, id: string) {
    const user = await db.getDocument('users', id);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    return user.get('prefs', {});
  }

  /**
   * Update user preferences
   */
  async updatePrefs(db: Database, id: string, prefs?: Record<string, any>) {
    const user = await db.getDocument('users', id);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const updatedUser = await db.updateDocument(
      'users',
      user.getId(),
      user.set('prefs', prefs),
    );

    return updatedUser.get('prefs');
  }

  /**
   * Update user status
   */
  async updateStatus(
    db: Database,
    id: string,
    { status }: UpdateUserStatusDTO,
  ) {
    const user = await db.getDocument('users', id);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    return db.updateDocument('users', user.getId(), user.set('status', status));
  }

  /**
   * Update user labels
   */
  async updateLabels(db: Database, id: string, { labels }: UpdateUserLabelDTO) {
    const user = await db.getDocument('users', id);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.set('labels', Array.from(new Set(labels)));

    return db.updateDocument('users', user.getId(), user);
  }

  /**
   * Update user name
   */
  async updateName(db: Database, id: string, { name }: UpdateUserNameDTO) {
    const user = await db.getDocument('users', id);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.set('name', name);
    return db.updateDocument('users', user.getId(), user);
  }

  /**
   * Update user password
   */
  async updatePassword(
    db: Database,
    id: string,
    { password }: UpdateUserPasswordDTO,
    project: ProjectsDoc,
  ) {
    const user = await db.getDocument('users', id);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    if (project.get('auths', {})['personalDataCheck'] ?? false) {
      const personalDataValidator = new PersonalDataValidator(
        id,
        user.get('email'),
        user.get('name'),
        user.get('phone'),
      );
      if (!personalDataValidator.$valid(password)) {
        throw new Exception(Exception.USER_PASSWORD_PERSONAL_DATA);
      }
    }

    if (password.length === 0) {
      const updatedUser = await db.updateDocument(
        'users',
        user.getId(),
        user.set('password', '').set('passwordUpdate', new Date()),
      );

      return updatedUser;
    }

    // TODO: Implement hooks
    // hooks.trigger('passwordValidator', [db, project, input.password, user, true]);

    const newPassword = await Auth.passwordHash(
      password,
      Auth.DEFAULT_ALGO,
      Auth.DEFAULT_ALGO_OPTIONS,
    );

    const historyLimit = project.get('auths', {})['passwordHistory'] ?? 0;
    let history = user.get('passwordHistory', []);

    if (newPassword && historyLimit > 0) {
      const validator = new PasswordHistoryValidator(
        history,
        user.get('hash'),
        user.get('hashOptions'),
      );
      if (!(await validator.$valid(password))) {
        throw new Exception(Exception.USER_PASSWORD_RECENTLY_USED);
      }

      history = [...history, newPassword].slice(-historyLimit);
    }

    const updatedUser = await db.updateDocument(
      'users',
      user.getId(),
      user
        .set('password', newPassword)
        .set('passwordHistory', history)
        .set('passwordUpdate', new Date())
        .set('hash', Auth.DEFAULT_ALGO)
        .set('hashOptions', Auth.DEFAULT_ALGO_OPTIONS),
    );

    return updatedUser;
  }

  /**
   * Update user email
   */
  async updateEmail(db: Database, id: string, email: string) {
    const user = await db.getDocument('users', id);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    email = email.toLowerCase();

    if (email.length !== 0) {
      // Check if email exists in identities
      const identityWithMatchingEmail = await db.findOne('identities', [
        Query.equal('providerEmail', [email]),
        Query.notEqual('userInternalId', user.getSequence()),
      ]);
      if (!identityWithMatchingEmail.empty()) {
        throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS);
      }

      const target = await db.findOne('targets', [
        Query.equal('identifier', [email]),
      ]);

      if (!target.empty()) {
        throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
      }
    }

    const oldEmail = user.get('email');
    user.set('email', email).set('emailVerification', false);

    try {
      const updatedUser = await db.updateDocument('users', user.getId(), user);
      const oldTarget = updatedUser.findWhere(
        'targets',
        (t: TargetsDoc) => t.get('identifier') === oldEmail,
      );

      if (oldTarget && !oldTarget.empty()) {
        if (email.length !== 0) {
          await db.updateDocument(
            'targets',
            oldTarget.getId(),
            oldTarget.set('identifier', email),
          );
        } else {
          await db.deleteDocument('targets', oldTarget.getId());
        }
      } else {
        if (email.length !== 0) {
          const target = await db.createDocument(
            'targets',
            new Doc({
              $permissions: [
                Permission.read(Role.user(user.getId())),
                Permission.update(Role.user(user.getId())),
                Permission.delete(Role.user(user.getId())),
              ],
              userId: user.getId(),
              userInternalId: user.getSequence(),
              providerType: 'email',
              identifier: email,
            }),
          );
          updatedUser.set('targets', [
            ...updatedUser.get('targets', []),
            target,
          ]);
        }
      }

      await db.purgeCachedDocument('users', user.getId());
      return updatedUser;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Update user phone
   */
  async updatePhone(db: Database, id: string, phone: string) {
    const user = await db.getDocument('users', id);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const oldPhone = user.get('phone');
    user.set('phone', phone).set('phoneVerification', false);

    if (phone.length !== 0) {
      const target = await db.findOne('targets', [
        Query.equal('identifier', [phone]),
      ]);

      if (!target.empty()) {
        throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
      }
    }

    try {
      const updatedUser = await db.updateDocument('users', user.getId(), user);
      const oldTarget = updatedUser.findWhere(
        'targets',
        (t: TargetsDoc) => t.get('identifier') === oldPhone,
      );

      if (oldTarget && !oldTarget.empty()) {
        if (phone.length !== 0) {
          await db.updateDocument(
            'targets',
            oldTarget.getId(),
            oldTarget.set('identifier', phone),
          );
        } else {
          await db.deleteDocument('targets', oldTarget.getId());
        }
      } else {
        if (phone.length !== 0) {
          const target = await db.createDocument(
            'targets',
            new Doc({
              $permissions: [
                Permission.read(Role.user(user.getId())),
                Permission.update(Role.user(user.getId())),
                Permission.delete(Role.user(user.getId())),
              ],
              userId: user.getId(),
              userInternalId: user.getSequence(),
              providerType: 'sms',
              identifier: phone,
            }),
          );
          updatedUser.set('targets', [
            ...updatedUser.get('targets', []),
            target,
          ]);
        }
      }
      await db.purgeCachedDocument('users', user.getId());
      return updatedUser;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_PHONE_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Update user emailVerification
   */
  async updateEmailVerification(
    db: Database,
    id: string,
    input: UpdateUserEmailVerificationDTO,
  ) {
    const user = await db.getDocument('users', id);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const updatedUser = await db.updateDocument(
      'users',
      user.getId(),
      user.set('emailVerification', input.emailVerification),
    );

    return updatedUser;
  }

  /**
   * Update user's phoneVerification
   */
  async updatePhoneVerification(
    db: Database,
    id: string,
    input: UpdateUserPoneVerificationDTO,
  ) {
    const user = await db.getDocument('users', id);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const updatedUser = await db.updateDocument(
      'users',
      user.getId(),
      user.set('phoneVerification', input.phoneVerification),
    );

    return updatedUser;
  }

  /**
   * Create a new user
   */
  create(db: Database, createUserDTO: CreateUserDTO, project: ProjectsDoc) {
    return this.createUser(
      db,
      project,
      HashAlgorithm.PLAINTEXT,
      {},
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
    );
  }

  /**
   * Create a new user with argon2
   */
  createWithArgon2(
    db: Database,
    createUserDTO: CreateUserDTO,
    project: ProjectsDoc,
  ) {
    return this.createUser(
      db,
      project,
      HashAlgorithm.ARGON2,
      {},
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
    );
  }

  /**
   * Create a new user with bcrypt
   */
  createWithBcrypt(
    db: Database,
    createUserDTO: CreateUserDTO,
    project: ProjectsDoc,
  ) {
    return this.createUser(
      db,
      project,
      HashAlgorithm.BCRYPT,
      {},
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
    );
  }

  /**
   * Create a new user with md5
   */
  createWithMd5(
    db: Database,
    createUserDTO: CreateUserDTO,
    project: ProjectsDoc,
  ) {
    return this.createUser(
      db,
      project,
      HashAlgorithm.MD5,
      {},
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
    );
  }

  /**
   * Create a new user with sha
   */
  createWithSha(
    db: Database,
    createUserDTO: CreateUserWithShaDTO,
    project: ProjectsDoc,
  ) {
    let hashOptions = {};
    if (createUserDTO.passwordVersion) {
      hashOptions = { version: createUserDTO.passwordVersion };
    }
    return this.createUser(
      db,
      project,
      HashAlgorithm.SHA,
      hashOptions,
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
    );
  }

  /**
   * Create a new user with phpass
   */
  createWithPhpass(
    db: Database,
    createUserDTO: CreateUserDTO,
    project: ProjectsDoc,
  ) {
    return this.createUser(
      db,
      project,
      HashAlgorithm.PHPASS,
      {},
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
    );
  }

  /**
   * Create a new user with scrypt
   */
  createWithScrypt(
    db: Database,
    createUserDTO: CreateUserWithScryptDTO,
    project: ProjectsDoc,
  ) {
    const hashOptions = {
      salt: createUserDTO.passwordSalt,
      costCpu: createUserDTO.passwordCpu,
      costMemory: createUserDTO.passwordMemory,
      costParallel: createUserDTO.passwordParallel,
      length: createUserDTO.passwordLength,
    };
    return this.createUser(
      db,
      project,
      HashAlgorithm.SCRYPT,
      hashOptions,
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
    );
  }

  /**
   * Create a new user with scryptMod
   */
  createWithScryptMod(
    db: Database,
    createUserDTO: CreateUserWithScryptModifedDTO,
    project: ProjectsDoc,
  ) {
    const hashOptions = {
      salt: createUserDTO.passwordSalt,
      saltSeparator: createUserDTO.passwordSaltSeparator,
      signerKey: createUserDTO.passwordSignerKey,
    };
    return this.createUser(
      db,
      project,
      HashAlgorithm.SCRYPT_MOD,
      hashOptions,
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
    );
  }

  /**
   * Get all memberships
   */
  async getMemberships(db: Database, userId: string) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }
    const memberships = user.get('memberships', []) as MembershipsDoc[];

    for (const membership of memberships) {
      const team = await db.getDocument('teams', membership.get('teamId'));

      membership
        .set('teamName', team.get('name'))
        .set('userName', user.get('name'))
        .set('userEmail', user.get('email'));
    }

    return {
      memberships: memberships,
      total: memberships.length,
    };
  }

  /**
   * Get all logs
   */
  async getLogs(
    db: Database,
    userId: string,
    locale: LocaleTranslator,
    queries: Query[] = [],
  ) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const grouped = Query.groupByType(queries);
    const limit = grouped['limit'];
    if (limit === undefined) {
      queries.push(Query.limit(configuration.limits.limitCount));
    }

    const audit = new Audit(db);
    const logs: any[] = await audit.getLogsByUser(user.getSequence(), queries);
    const output = [];

    for (const log of logs) {
      const userAgent = log.userAgent || 'UNKNOWN';
      const detector = new Detector(userAgent);
      // detector.skipBotDetection();

      const os = detector.getOS();
      const client = detector.getClient();
      const device = detector.getDevice();

      const countryCode = this.geoDb.get(log.ip)?.country?.iso_code;
      const countryName = locale.getText(
        `countries.${countryCode}`,
        locale.getText('locale.country.unknown'),
      );

      output.push(
        new Doc({
          event: log.event,
          userId: ID.custom(log.data.userId),
          userEmail: log.data.userEmail || null,
          userName: log.data.userName || null,
          ip: log.ip,
          time: log.time,
          osCode: os['osCode'],
          osName: os['osName'],
          osVersion: os['osVersion'],
          clientType: client['clientType'],
          clientCode: client['clientCode'],
          clientName: client['clientName'],
          clientVersion: client['clientVersion'],
          clientEngine: client['clientEngine'],
          clientEngineVersion: client['clientEngineVersion'],
          deviceName: device['deviceName'],
          deviceBrand: device['deviceBrand'],
          deviceModel: device['deviceModel'],
          countryCode,
          countryName,
        }),
      );
    }

    return {
      total: await audit.countLogsByUser(user.getSequence()),
      logs: output,
    };
  }

  /**
   * Get all identities
   */
  async getIdentities(db: Database, queries: Query[] = [], search?: string) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    const filterQueries = Query.groupByType(queries)['filters'];
    return {
      identities: await db.find('identities', queries),
      total: await db.count(
        'identities',
        filterQueries,
        configuration.limits.limitCount,
      ),
    };
  }

  /**
   * Delete an identity
   */
  async deleteIdentity(db: Database, identityId: string) {
    const identity = await db.getDocument('identities', identityId);

    if (identity.empty()) {
      throw new Exception(Exception.USER_IDENTITY_NOT_FOUND);
    }

    await db.deleteDocument('identities', identityId);
  }

  /**
   * Create a new Token
   */
  async createToken(
    db: Database,
    userId: string,
    input: CreateTokenDTO,
    userAgent: string,
    ip: string,
  ) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const secret = Auth.tokenGenerator(input.length);
    const expire = new Date(Date.now() + input.expire * 1000);

    const token = new Doc<Tokens>({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ],
      userId: user.getId(),
      userInternalId: user.getSequence(),
      type: TokenType.GENERIC,
      secret: Auth.hash(secret),
      expire: expire,
      userAgent: userAgent,
      ip: ip,
    });

    const createdToken = await db.createDocument('tokens', token);
    await db.purgeCachedDocument('users', user.getId());

    createdToken.set('secret', secret);

    return createdToken;
  }

  /**
   * Create Jwt
   */
  async createJwt(db: Database, userId: string, input: CreateJwtDTO) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const sessions = user.get('sessions', []) as SessionsDoc[];
    let session: SessionsDoc = new Doc();

    if (input.sessionId === 'recent') {
      // Get most recent
      session =
        sessions.length > 0 ? sessions[sessions.length - 1]! : new Doc();
    } else {
      for (const loopSession of sessions) {
        if (loopSession.getId() === input.sessionId) {
          session = loopSession;
          break;
        }
      }
    }

    return {
      jwt: this.jwtService.sign(
        {
          userId: user.getId(),
          sessionId: session.empty() ? '' : session.getId(),
        },
        { expiresIn: input.duration },
      ),
    };
  }

  /**
   * Delete User
   */
  async remove(db: Database, userId: string) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    // Clone user object to send to workers
    const clone = user.clone();
    await db.deleteDocument('users', userId);

    // TODO: Implement queue for deletes
  }

  /**
   * Create a new user
   * @param hash
   * @param hashOptions
   * @param userId
   * @param email
   * @param password
   * @param phone
   * @param name
   */
  async createUser(
    db: Database,
    project: ProjectsDoc,
    hash: HashAlgorithm,
    hashOptions: any,
    userId?: string,
    email?: string,
    password?: string | null,
    phone?: string,
    name?: string,
  ): Promise<UsersDoc> {
    const plaintextPassword = password;
    const hashOptionsObject =
      typeof hashOptions === 'string' ? JSON.parse(hashOptions) : hashOptions;
    const auths = project.get('auths', {});
    const passwordHistory = auths?.['passwordHistory'] ?? 0;

    if (email) {
      email = email.toLowerCase();

      // Check if email exists in identities
      const identityWithMatchingEmail = await db.findOne('identities', [
        Query.equal('providerEmail', [email]),
      ]);
      if (!identityWithMatchingEmail.empty()) {
        throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS);
      }
    }

    try {
      userId =
        !userId || userId === 'unique()' ? ID.unique() : ID.custom(userId);

      if (auths?.['personalDataCheck'] ?? false) {
        const personalDataValidator = new PersonalDataValidator(
          userId,
          email,
          name,
          phone,
          false, // strict
          true, // allowEmpty
        );
        if (!personalDataValidator.$valid(plaintextPassword!)) {
          throw new Exception(Exception.USER_PASSWORD_PERSONAL_DATA);
        }
      }

      password = password
        ? hash === HashAlgorithm.PLAINTEXT
          ? await Auth.passwordHash(password, hash, hashOptionsObject)
          : password
        : undefined;

      const user = new Doc<Users>({
        $id: userId,
        $permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ],
        email,
        emailVerification: false,
        phone,
        phoneVerification: false,
        status: true,
        labels: [],
        password,
        passwordHistory: !password || passwordHistory === 0 ? [] : [password],
        passwordUpdate: password ? new Date() : null,
        hash: hash === HashAlgorithm.PLAINTEXT ? Auth.DEFAULT_ALGO : hash,
        hashOptions:
          hash === HashAlgorithm.PLAINTEXT
            ? Auth.DEFAULT_ALGO_OPTIONS
            : { ...hashOptionsObject, type: hash },
        registration: new Date(),
        reset: false,
        name,
        prefs: {},
        search: [userId, email, phone, name].filter(Boolean).join(' '),
      });

      const createdUser = await db.createDocument('users', user);

      if (email) {
        try {
          const target = await db.createDocument(
            'targets',
            new Doc({
              $permissions: [
                Permission.read(Role.user(createdUser.getId())),
                Permission.update(Role.user(createdUser.getId())),
                Permission.delete(Role.user(createdUser.getId())),
              ],
              userId: createdUser.getId(),
              userInternalId: createdUser.getSequence(),
              providerType: 'email',
              identifier: email,
            }),
          );
          createdUser.set('targets', [
            ...createdUser.get('targets', []),
            target,
          ]);
        } catch (error) {
          if (error instanceof DuplicateException) {
            const existingTarget = await db.findOne('targets', [
              Query.equal('identifier', [email]),
            ]);
            if (existingTarget) {
              createdUser.append('targets', existingTarget);
            }
          } else throw error;
        }
      }

      if (phone) {
        try {
          const target = await db.createDocument(
            'targets',
            new Doc({
              $permissions: [
                Permission.read(Role.user(createdUser.getId())),
                Permission.update(Role.user(createdUser.getId())),
                Permission.delete(Role.user(createdUser.getId())),
              ],
              userId: createdUser.getId(),
              userInternalId: createdUser.getSequence(),
              providerType: 'sms',
              identifier: phone,
            }),
          );
          createdUser.set('targets', [
            ...createdUser.get('targets', []),
            target,
          ]);
        } catch (error) {
          if (error instanceof DuplicateException) {
            const existingTarget = await db.findOne('targets', [
              Query.equal('identifier', [phone]),
            ]);
            if (existingTarget) {
              createdUser.append('targets', existingTarget);
            }
          } else throw error;
        }
      }

      await db.purgeCachedDocument('users', createdUser.getId());
      this.event.emit(`user.${createdUser.getId()}.create`, createdUser);

      return createdUser;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Get usage statistics
   */
  async getUsage(db: Database, range: string = '1d') {
    const periods = usageConfig;
    const stats: Record<string, any> = {};
    const usage: Record<string, any> = {};
    const days = periods[range as keyof typeof periods];
    const metrics = [MetricFor.USERS, MetricFor.SESSIONS];

    await Authorization.skip(async () => {
      for (const metric of metrics) {
        const result = await db.findOne('stats', qb =>
          qb.equal('metric', metric).equal('period', MetricPeriod.INF),
        );

        stats[metric] = { total: result?.get('value') ?? 0, data: {} };

        const results = await db.find('stats', qb =>
          qb
            .equal('metric', metric)
            .equal('period', days.period)
            .limit(days.limit)
            .orderDesc('time'),
        );

        stats[metric].data = {};
        for (const result of results) {
          const time = StatsQueue.formatDate(
            days.period,
            result.get('time') as string,
          )!;
          stats[metric].data[time] = {
            value: result.get('value'),
          };
        }
      }
    });

    for (const metric of metrics) {
      usage[metric] = {
        total: stats[metric].total,
        data: [],
      };

      let leap = Math.floor(Date.now() / 1000) - days.limit * days.factor;

      while (leap < Math.floor(Date.now() / 1000)) {
        leap += days.factor;
        const formatDate = StatsQueue.formatDate(
          days.period,
          new Date(leap * 1000),
        )!;
        usage[metric].data.push({
          value: stats[metric].data[formatDate]?.value ?? 0,
          date: formatDate,
        });
      }
    }

    return new Doc({
      range: range,
      usersTotal: usage[metrics[0]!].total,
      sessionsTotal: usage[metrics[1]!].total,
      users: usage[metrics[0]!].data,
      sessions: usage[metrics[1]!].data,
    });
  }
}
