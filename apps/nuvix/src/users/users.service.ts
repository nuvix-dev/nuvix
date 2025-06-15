import { Inject, Injectable, Logger } from '@nestjs/common';
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
import { APP_LIMIT_COUNT, GEO_DB } from '@nuvix/utils/constants';
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
  Document,
  DuplicateException,
  Permission,
  Query,
  Role,
} from '@nuvix/database';
import { CountryResponse, Reader } from 'maxmind';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class UsersService {
  private logger: Logger = new Logger(UsersService.name);

  constructor(
    // @Inject(DB_FOR_PROJECT) private readonly db: Database,
    @Inject(GEO_DB) private readonly geoDb: Reader<CountryResponse>,
    private readonly jwtService: JwtService,
    private readonly event: EventEmitter2,
  ) {}

  /**
   * Find all users
   */
  async findAll(db: Database, queries: Query[] = [], search?: string) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    // Find cursor query if it exists
    const cursor = queries.find(query =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const userId = cursor.getValue();
      const cursorDocument = await db.getDocument('users', userId);

      if (cursorDocument.isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `User '${userId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    return user;
  }

  /**
   * Get user preferences
   */
  async getPrefs(db: Database, id: string) {
    const user = await db.getDocument('users', id);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    return user.getAttribute('prefs', {});
  }

  /**
   * Update user preferences
   */
  async updatePrefs(db: Database, id: string, prefs: any) {
    const user = await db.getDocument('users', id);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const updatedUser = await db.updateDocument(
      'users',
      user.getId(),
      user.setAttribute('prefs', prefs),
    );

    // TODO: Implement queue for events
    // queueForEvents.setParam('userId', updatedUser.getId());

    return updatedUser.getAttribute('prefs');
  }

  /**
   * Update user status
   */
  async updateStatus(db: Database, id: string, input: UpdateUserStatusDTO) {
    const user = await db.getDocument('users', id);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    return await db.updateDocument(
      'users',
      user.getId(),
      user.setAttribute('status', input.status),
    );
  }

  /**
   * Update user labels
   */
  async updateLabels(db: Database, id: string, input: UpdateUserLabelDTO) {
    const user = await db.getDocument('users', id);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.setAttribute('labels', Array.from(new Set(input.labels)));

    return await db.updateDocument('users', user.getId(), user);
  }

  /**
   * Update user name
   */
  async updateName(db: Database, id: string, input: UpdateUserNameDTO) {
    const user = await db.getDocument('users', id);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.setAttribute('name', input.name);

    return await db.updateDocument('users', user.getId(), user);
  }

  /**
   * Update user password
   */
  async updatePassword(
    db: Database,
    id: string,
    input: UpdateUserPasswordDTO,
    project: Document,
  ) {
    const user = await db.getDocument('users', id);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    if (project.getAttribute('auths', {})['personalDataCheck'] ?? false) {
      const personalDataValidator = new PersonalDataValidator(
        id,
        user.getAttribute('email'),
        user.getAttribute('name'),
        user.getAttribute('phone'),
      );
      if (!personalDataValidator.isValid(input.password)) {
        throw new Exception(Exception.USER_PASSWORD_PERSONAL_DATA);
      }
    }

    if (input.password.length === 0) {
      const updatedUser = await db.updateDocument(
        'users',
        user.getId(),
        user
          .setAttribute('password', '')
          .setAttribute('passwordUpdate', new Date()),
      );

      // TODO: Implement queue for events
      // queueForEvents.setParam('userId', updatedUser.getId());

      return updatedUser;
    }

    // TODO: Implement hooks
    // hooks.trigger('passwordValidator', [db, project, input.password, user, true]);

    const newPassword = await Auth.passwordHash(
      input.password,
      Auth.DEFAULT_ALGO,
      Auth.DEFAULT_ALGO_OPTIONS,
    );

    const historyLimit =
      project.getAttribute('auths', {})['passwordHistory'] ?? 0;
    let history = user.getAttribute('passwordHistory', []);

    if (historyLimit > 0) {
      const validator = new PasswordHistoryValidator(
        history,
        user.getAttribute('hash'),
        user.getAttribute('hashOptions'),
      );
      if (!validator.isValid(input.password)) {
        throw new Exception(Exception.USER_PASSWORD_RECENTLY_USED);
      }

      history = [...history, newPassword].slice(-historyLimit);
    }

    const updatedUser = await db.updateDocument(
      'users',
      user.getId(),
      user
        .setAttribute('password', newPassword)
        .setAttribute('passwordHistory', history)
        .setAttribute('passwordUpdate', new Date())
        .setAttribute('hash', Auth.DEFAULT_ALGO)
        .setAttribute('hashOptions', Auth.DEFAULT_ALGO_OPTIONS),
    );

    return updatedUser;
  }

  /**
   * Update user email
   */
  async updateEmail(db: Database, id: string, email: string) {
    const user = await db.getDocument('users', id);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    email = email.toLowerCase();

    if (email.length !== 0) {
      // Check if email exists in identities
      const identityWithMatchingEmail = await db.findOne('identities', [
        Query.equal('providerEmail', [email]),
        Query.notEqual('userInternalId', user.getInternalId()),
      ]);
      if (!identityWithMatchingEmail.isEmpty()) {
        throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS);
      }

      const target = await db.findOne('targets', [
        Query.equal('identifier', [email]),
      ]);

      if (!target.isEmpty()) {
        throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
      }
    }

    const oldEmail = user.getAttribute('email');

    user.setAttribute('email', email).setAttribute('emailVerification', false);

    try {
      const updatedUser = await db.updateDocument('users', user.getId(), user);
      const oldTarget = updatedUser.find<any>(
        'identifier',
        oldEmail,
        'targets',
      );

      if (!oldTarget.isEmpty()) {
        if (email.length !== 0) {
          await db.updateDocument(
            'targets',
            oldTarget.getId(),
            oldTarget.setAttribute('identifier', email),
          );
        } else {
          await db.deleteDocument('targets', oldTarget.getId());
        }
      } else {
        if (email.length !== 0) {
          const target = await db.createDocument(
            'targets',
            new Document({
              $permissions: [
                Permission.read(Role.user(user.getId())),
                Permission.update(Role.user(user.getId())),
                Permission.delete(Role.user(user.getId())),
              ],
              userId: user.getId(),
              userInternalId: user.getInternalId(),
              providerType: 'email',
              identifier: email,
            }),
          );
          updatedUser.setAttribute('targets', [
            ...updatedUser.getAttribute('targets', []),
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const oldPhone = user.getAttribute('phone');

    user.setAttribute('phone', phone).setAttribute('phoneVerification', false);

    if (phone.length !== 0) {
      const target = await db.findOne('targets', [
        Query.equal('identifier', [phone]),
      ]);

      if (!target.isEmpty()) {
        throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
      }
    }

    try {
      const updatedUser = await db.updateDocument('users', user.getId(), user);
      const oldTarget = updatedUser.find<any>(
        'identifier',
        oldPhone,
        'targets',
      );

      if (!oldTarget.isEmpty()) {
        if (phone.length !== 0) {
          await db.updateDocument(
            'targets',
            oldTarget.getId(),
            oldTarget.setAttribute('identifier', phone),
          );
        } else {
          await db.deleteDocument('targets', oldTarget.getId());
        }
      } else {
        if (phone.length !== 0) {
          const target = await db.createDocument(
            'targets',
            new Document({
              $permissions: [
                Permission.read(Role.user(user.getId())),
                Permission.update(Role.user(user.getId())),
                Permission.delete(Role.user(user.getId())),
              ],
              userId: user.getId(),
              userInternalId: user.getInternalId(),
              providerType: 'sms',
              identifier: phone,
            }),
          );
          updatedUser.setAttribute('targets', [
            ...updatedUser.getAttribute('targets', []),
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const updatedUser = await db.updateDocument(
      'users',
      user.getId(),
      user.setAttribute('emailVerification', input.emailVerification),
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const updatedUser = await db.updateDocument(
      'users',
      user.getId(),
      user.setAttribute('phoneVerification', input.phoneVerification),
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.setAttribute('mfa', mfa);

    const updatedUser = await db.updateDocument('users', user.getId(), user);

    // TODO: Implement queue for events
    // queueForEvents.setParam('userId', updatedUser.getId());

    return updatedUser;
  }

  /**
   * Create a new user
   */
  create(db: Database, createUserDTO: CreateUserDTO, project: Document) {
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
    project: Document,
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
    project: Document,
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
  createWithMd5(db: Database, createUserDTO: CreateUserDTO, project: Document) {
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
    project: Document,
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
    project: Document,
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
    project: Document,
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
    project: Document,
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
  async createTarget(db: Database, userId: string, input: CreateTargetDTO) {
    const targetId =
      input.targetId === 'unique()' ? ID.unique() : input.targetId;

    let provider: Document;
    if (input.providerId) {
      provider = await db.getDocument('providers', input.providerId);
    }

    switch (input.providerType) {
      case 'email':
        if (!new EmailValidator().isValid(input.identifier)) {
          throw new Exception(Exception.GENERAL_INVALID_EMAIL);
        }
        break;
      case 'sms':
        if (!new PhoneValidator().isValid(input.identifier)) {
          throw new Exception(Exception.GENERAL_INVALID_PHONE);
        }
        break;
      case 'push':
        break;
      default:
        throw new Exception(Exception.PROVIDER_INCORRECT_TYPE);
    }

    const user = await db.getDocument('users', userId);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const existingTarget = await db.getDocument('targets', targetId);

    if (!existingTarget.isEmpty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
    }

    try {
      const target = await db.createDocument(
        'targets',
        new Document({
          $id: targetId,
          $permissions: [
            Permission.read(Role.user(user.getId())),
            Permission.update(Role.user(user.getId())),
            Permission.delete(Role.user(user.getId())),
          ],
          providerId: provider ? provider.getId() : null,
          providerInternalId: provider ? provider.getInternalId() : null,
          providerType: input.providerType,
          userId: userId,
          userInternalId: user.getInternalId(),
          identifier: input.identifier,
          name: input.name || null,
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    queries.push(Query.equal('userId', [userId]));

    // Find cursor query if it exists
    const cursor = queries.find(query =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const targetId = cursor.getValue();
      const cursorDocument = await db.getDocument('targets', targetId);

      if (cursorDocument.isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Target '${targetId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const target = await db.getDocument('targets', targetId);

    if (target.isEmpty()) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    if (user.getId() !== target.getAttribute('userId')) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    if (input.identifier) {
      const providerType = target.getAttribute('providerType');

      switch (providerType) {
        case 'email':
          if (!new EmailValidator().isValid(input.identifier)) {
            throw new Exception(Exception.GENERAL_INVALID_EMAIL);
          }
          break;
        case 'sms':
          if (!new PhoneValidator().isValid(input.identifier)) {
            throw new Exception(Exception.GENERAL_INVALID_PHONE);
          }
          break;
        case 'push':
          break;
        default:
          throw new Exception(Exception.PROVIDER_INCORRECT_TYPE);
      }

      target.setAttribute('identifier', input.identifier);
    }

    if (input.providerId) {
      const provider = await db.getDocument('providers', input.providerId);

      if (provider.isEmpty()) {
        throw new Exception(Exception.PROVIDER_NOT_FOUND);
      }

      if (
        provider.getAttribute('type') !== target.getAttribute('providerType')
      ) {
        throw new Exception(Exception.PROVIDER_INCORRECT_TYPE);
      }

      target.setAttribute('providerId', provider.getId());
      target.setAttribute('providerInternalId', provider.getInternalId());
    }

    if (input.name) {
      target.setAttribute('name', input.name);
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const target = await db.getDocument('targets', targetId);

    if (target.isEmpty() || target.getAttribute('userId') !== userId) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    return target;
  }

  /**
   * Delete a target
   */
  async deleteTarget(db: Database, userId: string, targetId: string) {
    const user = await db.getDocument('users', userId);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const target = await db.getDocument('targets', targetId);

    if (target.isEmpty()) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    if (user.getId() !== target.getAttribute('userId')) {
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const sessions = user.getAttribute('sessions', []);

    for (const session of sessions) {
      const countryCode = session.getAttribute('countryCode', '');
      // TODO: Implement proper locale/translation service
      const countryName = countryCode ? countryCode.toLowerCase() : 'unknown';

      session.setAttribute('countryName', countryName);
      session.setAttribute('current', false);
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }
    const memberships = user.getAttribute('memberships', []);

    for (const membership of memberships) {
      const team = await db.getDocument(
        'teams',
        membership.getAttribute('teamId'),
      );

      membership
        .setAttribute('teamName', team.getAttribute('name'))
        .setAttribute('userName', user.getAttribute('name'))
        .setAttribute('userEmail', user.getAttribute('email'));
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const totp = TOTP.getAuthenticatorFromUser(user);

    return new Document({
      [MfaType.TOTP]: totp !== null && totp.getAttribute('verified', false),
      [MfaType.EMAIL]:
        user.getAttribute('email', false) &&
        user.getAttribute('emailVerification', false),
      [MfaType.PHONE]:
        user.getAttribute('phone', false) &&
        user.getAttribute('phoneVerification', false),
    });
  }

  /**
   * Get Mfa Recovery Codes
   */
  async getMfaRecoveryCodes(db: Database, userId: string) {
    const user = await db.getDocument('users', userId);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const mfaRecoveryCodes = user.getAttribute('mfaRecoveryCodes', []);

    if (!mfaRecoveryCodes.length) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND);
    }

    return new Document({
      recoveryCodes: mfaRecoveryCodes,
    });
  }

  /**
   * Generate Mfa Recovery Codes
   */
  async generateMfaRecoveryCodes(db: Database, userId: string) {
    const user = await db.getDocument('users', userId);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const mfaRecoveryCodes = user.getAttribute('mfaRecoveryCodes', []);

    if (mfaRecoveryCodes.length > 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_ALREADY_EXISTS);
    }

    const newRecoveryCodes = MfaType.generateBackupCodes();
    user.setAttribute('mfaRecoveryCodes', newRecoveryCodes);
    await db.updateDocument('users', user.getId(), user);

    // TODO: Implement queue for events
    // queueForEvents.setParam('userId', user.getId());

    return new Document({
      recoveryCodes: newRecoveryCodes,
    });
  }

  /**
   * Regenerate Mfa Recovery Codes
   */
  async regenerateMfaRecoveryCodes(db: Database, userId: string) {
    const user = await db.getDocument('users', userId);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const mfaRecoveryCodes = user.getAttribute('mfaRecoveryCodes', []);
    if (!mfaRecoveryCodes.length) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND);
    }

    const newRecoveryCodes = MfaType.generateBackupCodes();
    user.setAttribute('mfaRecoveryCodes', newRecoveryCodes);
    await db.updateDocument('users', user.getId(), user);

    // TODO: Implement queue for events
    // queueForEvents.setParam('userId', user.getId());

    return new Document({
      recoveryCodes: newRecoveryCodes,
    });
  }

  /**
   * Delete Mfa Authenticator
   */
  async deleteMfaAuthenticator(db: Database, userId: string, type: string) {
    const user = await db.getDocument('users', userId);

    if (user.isEmpty()) {
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    // Parse and group queries
    const grouped = Query.groupByType(queries);
    const limit = grouped['limit'] ?? APP_LIMIT_COUNT;
    const offset = grouped['offset'] ?? 0;

    // Get logs from audit service
    // const audit = new Audit(db);
    const logs = []; //await audit.getLogsByUser(user.getInternalId(), limit, offset);
    const output = [];

    for (const log of logs) {
      const userAgent = log.userAgent || 'UNKNOWN';
      const detector = new Detector(userAgent);
      // detector.skipBotDetection();

      const os = detector.getOS();
      const client = detector.getClient();
      const device = detector.getDevice();

      output.push(
        new Document({
          event: log.event,
          userId: ID.custom(log.data.userId),
          userEmail: log.data.userEmail || null,
          userName: log.data.userName || null,
          ip: log.ip,
          time: log.time,
          osCode: os.osCode,
          osName: os.osName,
          osVersion: os.osVersion,
          clientType: client.clientType,
          clientCode: client.clientCode,
          clientName: client.clientName,
          clientVersion: client.clientVersion,
          clientEngine: client.clientEngine,
          clientEngineVersion: client.clientEngineVersion,
          deviceName: device.deviceName,
          deviceBrand: device.deviceBrand,
          deviceModel: device.deviceModel,
          countryCode: '--', // TODO: Implement geodb lookup
          countryName: 'Unknown', // TODO: Implement locale translations
        }),
      );
    }

    return {
      total: 0, // await audit.countLogsByUser(user.getInternalId()),
      logs: output,
    };
  }

  /**
   * Get all identities
   */
  async getIdentities(db: Database, queries: Query[] = [], search?: string) {
    // Handle search param if provided
    if (search) {
      queries.push(Query.search('search', search));
    }

    // Find cursor query if it exists
    const cursor = queries.find(query =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const identityId = cursor.getValue();
      const cursorDocument = await db.getDocument('identities', identityId);

      if (cursorDocument.isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `User '${identityId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    // Get filter queries
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

    if (identity.isEmpty()) {
      throw new Exception(Exception.USER_IDENTITY_NOT_FOUND);
    }

    await db.deleteDocument('identities', identityId);

    // TODO: Implement queue for events
    // queueForEvents
    //   .setParam('userId', identity.getAttribute('userId'))
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const secret = Auth.tokenGenerator(input.length);
    const expire = new Date(Date.now() + input.expire * 1000);

    const token = new Document({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ],
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      type: Auth.TOKEN_TYPE_GENERIC,
      secret: Auth.hash(secret),
      expire: expire,
      userAgent: req.headers['user-agent'] || 'UNKNOWN',
      ip: req.ip,
    });

    const createdToken = await db.createDocument('tokens', token);
    await db.purgeCachedDocument('users', user.getId());

    createdToken.setAttribute('secret', secret);

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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const sessions = user.getAttribute('sessions', []);
    let session = new Document();

    if (input.sessionId === 'recent') {
      // Get most recent
      session =
        sessions.length > 0 ? sessions[sessions.length - 1] : new Document();
    } else {
      // Find by ID
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
          sessionId: session.isEmpty() ? '' : session.getId(),
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
    project: Document,
  ) {
    const user = await db.getDocument('users', userId);

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION);
    const detector = new Detector(req.headers['user-agent'] || 'UNKNOWN');
    const record = this.geoDb.get(req.ip);

    const duration =
      project.getAttribute('auths', {})['duration'] ??
      Auth.TOKEN_EXPIRATION_LOGIN_LONG;
    const expire = new Date(Date.now() + duration * 1000);

    const session = new Document<any>({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ],
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      provider: Auth.SESSION_PROVIDER_SERVER,
      secret: Auth.hash(secret),
      userAgent: req.headers['user-agent'] || 'UNKNOWN',
      ip: req.ip,
      countryCode: record ? record.country.iso_code.toLowerCase() : '',
      expire: expire,
      ...detector.getOS(),
      ...detector.getClient(),
      ...detector.getDevice(),
    });

    // TODO: Implement proper locale/translation service
    const countryName = 'Unknown';

    const createdSession = await db.createDocument('sessions', session);
    createdSession
      .setAttribute('secret', secret)
      .setAttribute('countryName', countryName);

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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const session = await db.getDocument('sessions', sessionId);

    if (session.isEmpty()) {
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

    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const sessions = user.getAttribute('sessions', []);

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

    if (user.isEmpty()) {
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
    project: Document,
  ): Promise<Document> {
    const plaintextPassword = password;
    const hashOptionsObject =
      typeof hashOptions === 'string' ? JSON.parse(hashOptions) : hashOptions;
    const auths = project.getAttribute('auths', {});
    const passwordHistory = auths?.passwordHistory ?? 0;

    if (email) {
      email = email.toLowerCase();

      // Check if email exists in identities
      const identityWithMatchingEmail = await db.findOne('identities', [
        Query.equal('providerEmail', [email]),
      ]);
      if (!identityWithMatchingEmail.isEmpty()) {
        throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS);
      }
    }

    try {
      userId = userId === 'unique()' ? ID.unique() : ID.custom(userId);

      if (auths?.personalDataCheck ?? false) {
        const personalDataValidator = new PersonalDataValidator(
          userId,
          email,
          name,
          phone,
          false, // strict
          true, // allowEmpty
        );
        if (!personalDataValidator.isValid(plaintextPassword)) {
          throw new Exception(Exception.USER_PASSWORD_PERSONAL_DATA);
        }
      }

      password = password
        ? hash === 'plaintext'
          ? await Auth.passwordHash(password, hash, hashOptionsObject)
          : password
        : null;

      const user = new Document<any>({
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
        sessions: null,
        tokens: null,
        memberships: null,
        search: [userId, email, phone, name].filter(Boolean).join(' '),
      });

      const createdUser = await db.createDocument('users', user);

      if (email) {
        try {
          const target = await db.createDocument(
            'targets',
            new Document({
              $permissions: [
                Permission.read(Role.user(createdUser.getId())),
                Permission.update(Role.user(createdUser.getId())),
                Permission.delete(Role.user(createdUser.getId())),
              ],
              userId: createdUser.getId(),
              userInternalId: createdUser.getInternalId(),
              providerType: 'email',
              identifier: email,
            }),
          );
          createdUser.setAttribute('targets', [
            ...createdUser.getAttribute('targets', []),
            target,
          ]);
        } catch (error) {
          if (error instanceof DuplicateException) {
            const existingTarget = await db.findOne('targets', [
              Query.equal('identifier', [email]),
            ]);
            if (existingTarget) {
              createdUser.setAttribute(
                'targets',
                existingTarget,
                Document.SET_TYPE_APPEND,
              );
            }
          } else throw error;
        }
      }

      if (phone) {
        try {
          const target = await db.createDocument(
            'targets',
            new Document({
              $permissions: [
                Permission.read(Role.user(createdUser.getId())),
                Permission.update(Role.user(createdUser.getId())),
                Permission.delete(Role.user(createdUser.getId())),
              ],
              userId: createdUser.getId(),
              userInternalId: createdUser.getInternalId(),
              providerType: 'sms',
              identifier: phone,
            }),
          );
          createdUser.setAttribute('targets', [
            ...createdUser.getAttribute('targets', []),
            target,
          ]);
        } catch (error) {
          if (error instanceof DuplicateException) {
            const existingTarget = await db.findOne('targets', [
              Query.equal('identifier', [phone]),
            ]);
            if (existingTarget) {
              createdUser.setAttribute(
                'targets',
                existingTarget,
                Document.SET_TYPE_APPEND,
              );
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

    const stats = {};
    const usage = {};
    const days = periods[range];
    const metrics = ['users', 'sessions'];

    // Skip authorization check as per PHP version
    for (const metric of metrics) {
      const result = await db.findOne('stats', [
        Query.equal('metric', [metric]),
        Query.equal('period', ['inf']),
      ]);

      stats[metric] = { total: result?.getAttribute('value') ?? 0, data: {} };

      const results = await db.find('stats', [
        Query.equal('metric', [metric]),
        Query.equal('period', [days.period]),
        Query.limit(days.limit),
        Query.orderDesc('time'),
      ]);

      stats[metric].data = {};
      for (const result of results) {
        stats[metric].data[result.getAttribute('time')] = {
          value: result.getAttribute('value'),
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

    return new Document({
      range: range,
      usersTotal: usage[metrics[0]].total,
      sessionsTotal: usage[metrics[1]].total,
      users: usage[metrics[0]].data,
      sessions: usage[metrics[1]].data,
    });
  }
}
