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
import { APP_LIMIT_COUNT, MessageType } from '@nuvix/utils';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { CreateTargetDTO, UpdateTargetDTO } from './DTO/target.dto';
import { EmailValidator } from '@nuvix/core/validators/email.validator';
import { PhoneValidator } from '@nuvix/core/validators/phone.validator';
import { PasswordHistoryValidator } from '@nuvix/core/validators/password-history.validator';
import { MfaType, TOTP } from '@nuvix/core/validators/MFA.validator';
import { Detector } from '@nuvix/core/helper/detector.helper';

import { CreateTokenDTO } from './DTO/token.dto';
import { CreateJwtDTO } from './DTO/jwt.dto';
import { JwtService } from '@nestjs/jwt';
import {
  Database,
  Doc,
  DuplicateException,
  Permission,
  Query,
  Role,
} from '@nuvix-tech/db';
import { CountryResponse, Reader } from 'maxmind';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoreService } from '@nuvix/core';
import type {
  MembershipsDoc,
  ProjectsDoc,
  ProvidersDoc,
  SessionsDoc,
  TargetsDoc,
  Tokens,
  Users,
  UsersDoc,
} from '@nuvix/utils/types';

@Injectable()
export class UsersService {
  private logger: Logger = new Logger(UsersService.name);
  private readonly geoDb: Reader<CountryResponse>;

  constructor(
    private readonly coreService: CoreService,
    private readonly jwtService: JwtService,
    private readonly event: EventEmitter2,
  ) {
    this.geoDb = coreService.getGeoDb();
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
      total: await db.count('users', filterQueries, APP_LIMIT_COUNT),
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

    // TODO: Implement queue for events
    // queueForEvents.setParam('userId', updatedUser.getId());

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

      // TODO: Implement queue for events
      // queueForEvents.setParam('userId', updatedUser.getId());

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

    // TODO: Implement queue for events
    // queueForEvents.setParam('userId', user.getId());

    return updatedUser;
  }

  /**
   * Update Mfa Status
   */
  async updateMfaStatus(db: Database, id: string, mfa: boolean) {
    const user = await db.getDocument('users', id);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.set('mfa', mfa);

    const updatedUser = await db.updateDocument('users', user.getId(), user);

    // TODO: Implement queue for events
    // queueForEvents.setParam('userId', updatedUser.getId());

    return updatedUser;
  }

  /**
   * Create a new user
   */
  create(db: Database, createUserDTO: CreateUserDTO, project: ProjectsDoc) {
    return this.createUser(
      db,
      'plaintext',
      {},
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
      project,
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
      'argon2',
      {},
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
      project,
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
      'bcrypt',
      {},
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
      project,
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
      'md5',
      {},
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
      project,
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
      'sha',
      hashOptions,
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
      project,
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
      'phpass',
      {},
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
      project,
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
      'scrypt',
      hashOptions,
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
      project,
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
      'scryptMod',
      hashOptions,
      createUserDTO.userId,
      createUserDTO.email,
      createUserDTO.password,
      createUserDTO.phone,
      createUserDTO.name,
      project,
    );
  }

  /**
   * Create a new target
   */
  async createTarget(
    db: Database,
    userId: string,
    { targetId, providerId, ...input }: CreateTargetDTO,
  ) {
    targetId = targetId === 'unique()' ? ID.unique() : targetId;

    let provider!: ProvidersDoc;
    if (providerId) {
      provider = await db.getDocument('providers', providerId);
    }

    switch (input.providerType as MessageType) {
      case MessageType.EMAIL:
        if (!new EmailValidator().$valid(input.identifier)) {
          throw new Exception(Exception.GENERAL_INVALID_EMAIL);
        }
        break;
      case MessageType.PUSH:
        break;
      case MessageType.SMS:
        if (!new PhoneValidator().$valid(input.identifier)) {
          throw new Exception(Exception.GENERAL_INVALID_PHONE);
        }
        break;
      default:
        throw new Exception(Exception.PROVIDER_INCORRECT_TYPE);
    }

    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const existingTarget = await db.getDocument('targets', targetId);

    if (!existingTarget.empty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
    }

    try {
      const target = await db.createDocument(
        'targets',
        new Doc({
          $id: targetId,
          $permissions: [
            Permission.read(Role.user(user.getId())),
            Permission.update(Role.user(user.getId())),
            Permission.delete(Role.user(user.getId())),
          ],
          providerId: provider?.getId(),
          providerInternalId: provider?.getSequence(),
          providerType: input.providerType,
          userId: userId,
          userInternalId: user.getSequence(),
          identifier: input.identifier,
          name: input.name,
        }),
      );

      await db.purgeCachedDocument('users', user.getId());
      this.event.emit(
        `user.${user.getId()}.target.${target.getId()}.create`,
        target,
      );

      return target;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Get all targets for a user
   */
  async getTargets(db: Database, userId: string, queries: Query[] = []) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }
    queries.push(Query.equal('userId', [userId]));

    return {
      targets: await db.find('targets', queries),
      total: await db.count('targets', queries, APP_LIMIT_COUNT),
    };
  }

  /**
   * Update a target
   */
  async updateTarget(
    db: Database,
    userId: string,
    targetId: string,
    input: UpdateTargetDTO,
  ) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const target = await db.getDocument('targets', targetId);

    if (target.empty()) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    if (user.getId() !== target.get('userId')) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    if (input.identifier) {
      const providerType = target.get('providerType');

      switch (providerType as MessageType) {
        case MessageType.EMAIL:
          if (!new EmailValidator().$valid(input.identifier)) {
            throw new Exception(Exception.GENERAL_INVALID_EMAIL);
          }
          break;
        case MessageType.PUSH:
          break;
        case MessageType.SMS:
          if (!new PhoneValidator().$valid(input.identifier)) {
            throw new Exception(Exception.GENERAL_INVALID_PHONE);
          }
          break;
        default:
          throw new Exception(Exception.PROVIDER_INCORRECT_TYPE);
      }

      target.set('identifier', input.identifier);
    }

    if (input.providerId) {
      const provider = await db.getDocument('providers', input.providerId);

      if (provider.empty()) {
        throw new Exception(Exception.PROVIDER_NOT_FOUND);
      }

      if (provider.get('type') !== target.get('providerType')) {
        throw new Exception(Exception.PROVIDER_INCORRECT_TYPE);
      }

      target.set('providerId', provider.getId());
      target.set('providerInternalId', provider.getSequence());
    }

    if (input.name) {
      target.set('name', input.name);
    }

    const updatedTarget = await db.updateDocument(
      'targets',
      target.getId(),
      target,
    );
    await db.purgeCachedDocument('users', user.getId());

    // TODO: Implement queue for events
    // queueForEvents.setParam('userId', user.getId());
    // queueForEvents.setParam('targetId', target.getId());

    return updatedTarget;
  }

  /**
   * Get A target
   */
  async getTarget(db: Database, userId: string, targetId: string) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const target = await db.getDocument('targets', targetId);

    if (target.empty() || target.get('userId') !== userId) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    return target;
  }

  /**
   * Delete a target
   */
  async deleteTarget(db: Database, userId: string, targetId: string) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const target = await db.getDocument('targets', targetId);

    if (target.empty()) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    if (user.getId() !== target.get('userId')) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    await db.deleteDocument('targets', target.getId());
    await db.purgeCachedDocument('users', user.getId());

    // TODO: Implement queue for deletes
    // queueForDeletes
    //   .setType(DELETE_TYPE_TARGET)
    //   .setDocument(target);

    // TODO: Implement queue for events
    // queueForEvents
    //   .setParam('userId', user.getId())
    //   .setParam('targetId', target.getId());

    return {};
  }

  /**
   * Get all sessions
   */
  async getSessions(db: Database, userId: string) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const sessions = user.get('sessions', []) as SessionsDoc[];

    for (const session of sessions) {
      const countryCode = session.get('countryCode', '');
      // TODO: Implement proper locale/translation service
      const countryName = countryCode ? countryCode.toLowerCase() : 'unknown';

      session.set('countryName', countryName);
      session.set('current', false);
    }

    return {
      sessions: sessions,
      total: sessions.length,
    };
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
   * Get Mfa factors
   */
  async getMfaFactors(db: Database, userId: string) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const totp = TOTP.getAuthenticatorFromUser(user);

    return new Doc({
      [MfaType.TOTP]: totp !== null && totp.get('verified', false),
      [MfaType.EMAIL]:
        user.get('email', false) && user.get('emailVerification', false),
      [MfaType.PHONE]:
        user.get('phone', false) && user.get('phoneVerification', false),
    });
  }

  /**
   * Get Mfa Recovery Codes
   */
  async getMfaRecoveryCodes(db: Database, userId: string) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const mfaRecoveryCodes = user.get('mfaRecoveryCodes', []);

    if (!mfaRecoveryCodes.length) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND);
    }

    return new Doc({
      recoveryCodes: mfaRecoveryCodes,
    });
  }

  /**
   * Generate Mfa Recovery Codes
   */
  async generateMfaRecoveryCodes(db: Database, userId: string) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const mfaRecoveryCodes = user.get('mfaRecoveryCodes', []);

    if (mfaRecoveryCodes.length > 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_ALREADY_EXISTS);
    }

    const newRecoveryCodes = TOTP.generateBackupCodes();
    user.set('mfaRecoveryCodes', newRecoveryCodes);
    await db.updateDocument('users', user.getId(), user);

    // TODO: Implement queue for events
    // queueForEvents.setParam('userId', user.getId());

    return new Doc({
      recoveryCodes: newRecoveryCodes,
    });
  }

  /**
   * Regenerate Mfa Recovery Codes
   */
  async regenerateMfaRecoveryCodes(db: Database, userId: string) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const mfaRecoveryCodes = user.get('mfaRecoveryCodes', []);
    if (!mfaRecoveryCodes.length) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND);
    }

    const newRecoveryCodes = TOTP.generateBackupCodes();
    user.set('mfaRecoveryCodes', newRecoveryCodes);
    await db.updateDocument('users', user.getId(), user);

    // TODO: Implement queue for events
    // queueForEvents.setParam('userId', user.getId());

    return new Doc({
      recoveryCodes: newRecoveryCodes,
    });
  }

  /**
   * Delete Mfa Authenticator
   */
  async deleteMfaAuthenticator(db: Database, userId: string, type: string) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const authenticator = TOTP.getAuthenticatorFromUser(user);

    if (authenticator === null) {
      throw new Exception(Exception.USER_AUTHENTICATOR_NOT_FOUND);
    }

    await db.deleteDocument('authenticators', authenticator.getId());
    await db.purgeCachedDocument('users', user.getId());

    // TODO: Implement queue for events
    // queueForEvents.setParam('userId', user.getId());

    return {};
  }

  /**
   * Get all logs
   */
  async getLogs(db: Database, userId: string, queries: Query[]) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    // Parse and group queries
    const grouped = Query.groupByType(queries);
    const limit = grouped['limit'] ?? APP_LIMIT_COUNT;
    const offset = grouped['offset'] ?? 0;

    // Get logs from audit service
    // const audit = new Audit(db);
    const logs: any[] = []; //await audit.getLogsByUser(user.getSequence(), limit, offset);
    const output = [];

    for (const log of logs) {
      const userAgent = log.userAgent || 'UNKNOWN';
      const detector = new Detector(userAgent);
      // detector.skipBotDetection();

      const os = detector.getOS();
      const client = detector.getClient();
      const device = detector.getDevice();

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
          countryCode: '--', // TODO: Implement geodb lookup
          countryName: 'Unknown', // TODO: Implement locale translations
        }),
      );
    }

    return {
      total: 0, // await audit.countLogsByUser(user.getSequence()),
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
      total: await db.count('identities', filterQueries, APP_LIMIT_COUNT),
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

    // TODO: Implement queue for events
    // queueForEvents
    //   .setParam('userId', identity.get('userId'))
    //   .setParam('identityId', identity.getId())
    //   .setPayload(identity); // TODO: Implement proper response formatter

    return {};
  }

  /**
   * Create a new Token
   */
  async createToken(
    db: Database,
    userId: string,
    input: CreateTokenDTO,
    req: NuvixRequest,
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
      type: Auth.TOKEN_TYPE_GENERIC,
      secret: Auth.hash(secret),
      expire: expire,
      userAgent: req.headers['user-agent'] || 'UNKNOWN',
      ip: req.ip,
    });

    const createdToken = await db.createDocument('tokens', token);
    await db.purgeCachedDocument('users', user.getId());

    createdToken.set('secret', secret);

    // TODO: Implement queue for events
    // queueForEvents
    //   .setParam('userId', user.getId())
    //   .setParam('tokenId', createdToken.getId())
    //   .setPayload(createdToken); // TODO: Implement proper response formatter

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
   * Create User Session
   */
  async createSession(
    db: Database,
    userId: string,
    req: NuvixRequest,
    project: ProjectsDoc,
  ) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION);
    const detector = new Detector(req.headers['user-agent'] || 'UNKNOWN');
    const record = this.geoDb.get(req.ip);

    const duration =
      project.get('auths', {})['duration'] ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG;
    const expire = new Date(Date.now() + duration * 1000);

    const session = new Doc<any>({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ],
      userId: user.getId(),
      userInternalId: user.getSequence(),
      provider: Auth.SESSION_PROVIDER_SERVER,
      secret: Auth.hash(secret),
      userAgent: req.headers['user-agent'] || 'UNKNOWN',
      ip: req.ip,
      countryCode: record?.country?.iso_code.toLowerCase(),
      expire: expire,
      ...detector.getOS(),
      ...detector.getClient(),
      ...detector.getDevice(),
    });

    // TODO: Implement proper locale/translation service
    const countryName = 'Unknown';

    const createdSession = await db.createDocument('sessions', session);
    createdSession.set('secret', secret).set('countryName', countryName);

    // TODO: Implement queue for events
    // queueForEvents
    //     .setParam('userId', user.getId())
    //     .setParam('sessionId', createdSession.getId())
    //     .setPayload(session); // TODO: Implement proper response formatter

    return createdSession;
  }

  /**
   * Delete User Session
   */
  async deleteSession(db: Database, userId: string, sessionId: string) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const session = await db.getDocument('sessions', sessionId);

    if (session.empty()) {
      throw new Exception(Exception.USER_SESSION_NOT_FOUND);
    }

    await db.deleteDocument('sessions', session.getId());
    await db.purgeCachedDocument('users', user.getId());

    // TODO: Implement queue for events
    // queueForEvents
    //   .setParam('userId', user.getId())
    //   .setParam('sessionId', sessionId)
    //   .setPayload(session); // TODO: Implement proper response formatter

    return {};
  }

  /**
   * Delete User Sessions
   */
  async deleteSessions(db: Database, userId: string) {
    const user = await db.getDocument('users', userId);

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const sessions = user.get('sessions', []) as SessionsDoc[];

    for (const session of sessions) {
      await db.deleteDocument('sessions', session.getId());
    }

    await db.purgeCachedDocument('users', user.getId());

    return {};
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
    // queueForDeletes
    //   .setType(DELETE_TYPE_DOCUMENT)
    //   .setDocument(clone);

    // TODO: Implement queue for events
    // queueForEvents
    //   .setParam('userId', user.getId())
    //   .setPayload(clone); // TODO: Implement proper response formatter

    return {};
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
    hash: string,
    hashOptions: any,
    userId: string,
    email: string | null,
    password: string | null,
    phone: string | null,
    name: string,
    project: ProjectsDoc,
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
      userId = userId === 'unique()' ? ID.unique() : ID.custom(userId);

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
        ? hash === 'plaintext'
          ? await Auth.passwordHash(password, hash, hashOptionsObject)
          : password
        : null;

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
        hash: hash === 'plaintext' ? Auth.DEFAULT_ALGO : hash,
        hashOptions:
          hash === 'plaintext'
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
    const periods = {
      '1d': { limit: 24, period: '1h', factor: 3600 },
      '7d': { limit: 7, period: '1d', factor: 86400 },
    };

    const stats: Record<string, any> = {};
    const usage: Record<string, any> = {};
    const days = periods[range as keyof typeof periods];
    const metrics = ['users', 'sessions'];

    // Skip authorization check as per PHP version
    for (const metric of metrics) {
      const result = await db.findOne('stats', [
        Query.equal('metric', [metric]),
        Query.equal('period', ['inf']),
      ]);

      stats[metric] = { total: result?.get('value') ?? 0, data: {} };

      const results = await db.find('stats', [
        Query.equal('metric', [metric]),
        Query.equal('period', [days.period]),
        Query.limit(days.limit),
        Query.orderDesc('time'),
      ]);

      stats[metric].data = {};
      for (const result of results) {
        stats[metric].data[result.get('time') as string] = {
          value: result.get('value'),
        };
      }
    }

    const format =
      days.period === '1h' ? 'Y-m-d\\TH:00:00.000P' : 'Y-m-d\\T00:00:00.000P';

    for (const metric of metrics) {
      usage[metric] = {
        total: stats[metric].total,
        data: [],
      };

      let leap = Math.floor(Date.now() / 1000) - days.limit * days.factor;

      while (leap < Math.floor(Date.now() / 1000)) {
        leap += days.factor;
        const formatDate = new Date(leap * 1000).toISOString();
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
