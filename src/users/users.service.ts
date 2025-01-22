import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { Exception } from 'src/core/extend/exception';
import { ID } from 'src/core/helper/ID.helper';
import Permission from 'src/core/helper/permission.helper';
import Role from 'src/core/helper/role.helper';
import { PersonalDataValidator } from 'src/core/validators/personal-data.validator';
import { ProjectDocument } from 'src/projects/schemas/project.schema';
import {
  CreateUserDto,
  CreateUserWithScryptDto,
  CreateUserWithScryptModifedDto,
  CreateUserWithShaDto,
  UpdateUserEmailVerificationDto,
  UpdateUserLabelDto,
  UpdateUserNameDto,
  UpdateUserPasswordDto,
  UpdateUserPoneVerificationDto,
  UpdateUserStatusDto,
} from './dto/user.dto';
import { ClsService } from 'nestjs-cls';
import { PROJECT } from 'src/Utils/constants';
import { Auth } from 'src/core/helper/auth.helper';
import { CreateTargetDto, UpdateTargetDto } from './dto/target.dto';
import { EmailValidator } from 'src/core/validators/email.validator';
import { PhoneValidator } from 'src/core/validators/phone.validator';
import { QueryBuilder } from 'src/core/helper/query.helper';
import { PasswordHistoryValidator } from 'src/core/validators/password-history.validator';
import { MfaType, TOTP } from 'src/core/validators/MFA.validator';
import { Detector } from 'src/core/helper/detector.helper';
import { Request } from 'express';
import { CreateTokenDto } from './dto/token.dto';
import { CreateJwtDto } from './dto/jwt.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  private logger: Logger = new Logger(UsersService.name);
  private userRepo: Repository<UserEntity>;
  private readonly identityRepo: Repository<IdentityEntity>;
  private readonly targetRepo: Repository<TargetEntity>;
  private readonly sessionRepo: Repository<SessionEntity>;
  private readonly memberRepo: Repository<MembershipEntity>;
  private readonly providerRepo: Repository<ProviderEntity>;
  private readonly authenticatorRepo: Repository<AuthenticatorEntity>;
  private readonly tokenRepo: Repository<TokenEntity>;
  private readonly statsRepo: Repository<StatsEntity>;

  constructor(
    @Inject('CONNECTION') private readonly dataSource: DataSource,
    private readonly cls: ClsService,
    private readonly jwtService: JwtService,
  ) {
    this.userRepo = this.dataSource.getRepository(UserEntity);
    this.identityRepo = this.dataSource.getRepository(IdentityEntity);
    this.targetRepo = this.dataSource.getRepository(TargetEntity);
    this.sessionRepo = this.dataSource.getRepository(SessionEntity);
    this.memberRepo = this.dataSource.getRepository(MembershipEntity);
    this.providerRepo = this.dataSource.getRepository(ProviderEntity);
    this.authenticatorRepo = this.dataSource.getRepository(AuthenticatorEntity);
    this.tokenRepo = this.dataSource.getRepository(TokenEntity);
    this.statsRepo = this.dataSource.getRepository(StatsEntity);
  }

  /**
   * Find all users
   */
  async findAll(queries: string[], search: string) {
    const query = new QueryBuilder(this.userRepo, ['name']);

    query.parseQueryStrings(queries);

    const { results, totalCount } = await query.execute();
    return {
      users: results,
      total: totalCount,
    };
  }

  /**
   * Find a user by id
   */
  async findOne(id: string) {
    let user = await this.userRepo.findOne({
      where: { $id: id },
      relations: ['targets'],
    });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }
    return user;
  }

  /**
   * Get user preferences
   */
  async getPrefs(id: string) {
    let user = await this.userRepo.findOneBy({ $id: id });

    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    return user.prefs;
  }

  /**
   * Update user preferences
   */
  async updatePrefs(id: string, prefs: any) {
    let user = await this.userRepo.findOneBy({ $id: id });

    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.prefs = prefs;
    await this.userRepo.save(user);
    return user.prefs;
  }

  /**
   * Update user status
   */
  async updateStatus(id: string, input: UpdateUserStatusDto) {
    let user = await this.userRepo.findOneBy({ $id: id });

    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.status = input.status;
    await this.userRepo.save(user);
    return user;
  }

  /**
   * Update user labels
   */
  async updateLabels(id: string, input: UpdateUserLabelDto) {
    let user = await this.userRepo.findOneBy({ $id: id });

    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.labels = Array.from(new Set(input.labels));
    await this.userRepo.save(user);
    return user;
  }

  /**
   * Update user name
   */
  async updateName(id: string, input: UpdateUserNameDto) {
    let user = await this.userRepo.findOneBy({ $id: id });

    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.name = input.name;
    await this.userRepo.save(user);
    return user;
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, input: UpdateUserPasswordDto) {
    let Project = this.cls.get<ProjectDocument>(PROJECT);
    let user = await this.userRepo.findOneBy({ $id: id });

    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    if (Project.auths?.personalDataCheck) {
      const personalDataValidator = new PersonalDataValidator(
        user.$id,
        user.email,
        user.name,
        user.phone,
      );
      if (!personalDataValidator.isValid(input.password)) {
        throw new Exception(Exception.USER_PASSWORD_PERSONAL_DATA);
      }
    }

    if (input.password.length === 0) {
      user.password = '';
      user.passwordUpdate = new Date();
      user = await this.userRepo.save(user);
      return user;
    }

    let hasPassword = await Auth.passwordHash(
      input.password,
      Auth.DEFAULT_ALGO,
      Auth.DEFAULT_ALGO_OPTIONS,
    );
    let passwordHistory = Project.auths?.passwordHistory ?? 0;
    if (passwordHistory > 0) {
      const validator = new PasswordHistoryValidator(
        user.passwordHistory,
        user.hash,
        user.hashOptions,
      );
      if (!validator.isValid(hasPassword)) {
        throw new Exception(Exception.USER_PASSWORD_RECENTLY_USED);
      }

      user.passwordHistory.push(hasPassword);
      user.passwordHistory = user.passwordHistory.slice(-passwordHistory);
    }

    user.password = hasPassword;
    user.passwordUpdate = new Date();
    user.hash = Auth.DEFAULT_ALGO;
    user.hashOptions = Auth.DEFAULT_ALGO_OPTIONS;

    await this.userRepo.save(user);
    return user;
  }

  /**
   * Update user email
   */
  async updateEmail(id: string, email: string) {
    let user = await this.userRepo.findOneBy({ $id: id });

    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    email = email.toLowerCase();

    if (email.length !== 0) {
      const identityWithMatchingEmail = await this.identityRepo.findOne({
        where: {
          providerEmail: email,
          userId: Not(id),
        },
      });
      if (identityWithMatchingEmail) {
        throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS);
      }

      const target = await this.targetRepo.findOne({
        where: {
          identifier: email,
        },
      });

      if (target) {
        throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
      }
    }

    const oldEmail = user.email;

    user.email = email;
    user.emailVerification = false;

    try {
      await this.userRepo.save(user);

      const oldTarget = await this.targetRepo.findOne({
        where: {
          identifier: oldEmail,
        },
      });

      if (oldTarget) {
        if (email.length !== 0) {
          oldTarget.identifier = email;
          await this.targetRepo.save(oldTarget);
        } else {
          await this.targetRepo.remove(oldTarget);
        }
      } else {
        if (email.length !== 0) {
          const newTarget = this.targetRepo.create({
            $permissions: [
              Permission.Read(Role.User(user.$id)),
              Permission.Update(Role.User(user.$id)),
              Permission.Delete(Role.User(user.$id)),
            ],
            userId: user.$id,
            user: user,
            providerType: 'email',
            identifier: email,
          });
          await this.targetRepo.save(newTarget);
        }
      }
    } catch (error) {
      throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS);
    }

    return user;
  }

  /**
   * Update user phone
   */
  async updatePhone(id: string, phone: string) {
    let user = await this.userRepo.findOneBy({ $id: id });

    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const oldPhone = user.phone;

    user.phone = phone;
    user.phoneVerification = false;

    if (phone.length !== 0) {
      const target = await this.targetRepo.findOne({
        where: {
          identifier: phone,
        },
      });

      if (target) {
        throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
      }
    }

    try {
      await this.userRepo.save(user);

      const oldTarget = await this.targetRepo.findOne({
        where: {
          identifier: oldPhone,
        },
      });

      if (oldTarget) {
        if (phone.length !== 0) {
          oldTarget.identifier = phone;
          await this.targetRepo.save(oldTarget);
        } else {
          await this.targetRepo.remove(oldTarget);
        }
      } else {
        if (phone.length !== 0) {
          const newTarget = this.targetRepo.create({
            $permissions: [
              Permission.Read(Role.User(user.$id)),
              Permission.Update(Role.User(user.$id)),
              Permission.Delete(Role.User(user.$id)),
            ],
            userId: user.$id,
            user: user,
            providerType: 'sms',
            identifier: phone,
          });
          await this.targetRepo.save(newTarget);
        }
      }
    } catch (error) {
      throw new Exception(Exception.USER_PHONE_ALREADY_EXISTS);
    }

    return user;
  }

  /**
   * Update user emailVerification
   */
  async updateEmailVerification(
    id: string,
    input: UpdateUserEmailVerificationDto,
  ) {
    let user = await this.userRepo.findOneBy({ $id: id });

    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.emailVerification = input.emailVerification;
    await this.userRepo.save(user);

    return user;
  }

  /**
   * Update user's phoneVerification
   */
  async updatePhoneVerification(
    id: string,
    input: UpdateUserPoneVerificationDto,
  ) {
    let user = await this.userRepo.findOneBy({ $id: id });

    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.phoneVerification = input.phoneVerification;
    await this.userRepo.save(user);
    return user;
  }

  /**
   * Update Mfa Status
   */
  async updateMfaStatus(id: string, mfa: boolean) {
    let user = await this.userRepo.findOneBy({ $id: id });

    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.mfa = mfa;
    await this.userRepo.save(user);
    return user;
  }

  /**
   * Create a new user
   */
  create(createUserDto: CreateUserDto) {
    return this.createUser(
      'plaintext',
      {},
      createUserDto.userId,
      createUserDto.email,
      createUserDto.password,
      createUserDto.phone,
      createUserDto.name,
    );
  }

  /**
   * Create a new user with argon2
   */
  createWithArgon2(createUserDto: CreateUserDto) {
    return this.createUser(
      'argon2',
      {},
      createUserDto.userId,
      createUserDto.email,
      createUserDto.password,
      createUserDto.phone,
      createUserDto.name,
    );
  }

  /**
   * Create a new user with bcrypt
   */
  createWithBcrypt(createUserDto: CreateUserDto) {
    return this.createUser(
      'bcrypt',
      {},
      createUserDto.userId,
      createUserDto.email,
      createUserDto.password,
      createUserDto.phone,
      createUserDto.name,
    );
  }

  /**
   * Create a new user with md5
   */
  createWithMd5(createUserDto: CreateUserDto) {
    return this.createUser(
      'md5',
      {},
      createUserDto.userId,
      createUserDto.email,
      createUserDto.password,
      createUserDto.phone,
      createUserDto.name,
    );
  }

  /**
   * Create a new user with sha
   */
  createWithSha(createUserDto: CreateUserWithShaDto) {
    let hashOptions = {};
    if (createUserDto.passwordVersion) {
      hashOptions = { version: createUserDto.passwordVersion };
    }
    return this.createUser(
      'sha',
      hashOptions,
      createUserDto.userId,
      createUserDto.email,
      createUserDto.password,
      createUserDto.phone,
      createUserDto.name,
    );
  }

  /**
   * Create a new user with phpass
   */
  createWithPhpass(createUserDto: CreateUserDto) {
    return this.createUser(
      'phpass',
      {},
      createUserDto.userId,
      createUserDto.email,
      createUserDto.password,
      createUserDto.phone,
      createUserDto.name,
    );
  }

  /**
   * Create a new user with scrypt
   */
  createWithScrypt(createUserDto: CreateUserWithScryptDto) {
    const hashOptions = {
      salt: createUserDto.passwordSalt,
      costCpu: createUserDto.passwordCpu,
      costMemory: createUserDto.passwordMemory,
      costParallel: createUserDto.passwordParallel,
      length: createUserDto.passwordLength,
    };
    return this.createUser(
      'scrypt',
      hashOptions,
      createUserDto.userId,
      createUserDto.email,
      createUserDto.password,
      createUserDto.phone,
      createUserDto.name,
    );
  }

  /**
   * Create a new user with scryptMod
   */
  createWithScryptMod(createUserDto: CreateUserWithScryptModifedDto) {
    const hashOptions = {
      salt: createUserDto.passwordSalt,
      saltSeparator: createUserDto.passwordSaltSeparator,
      signerKey: createUserDto.passwordSignerKey,
    };
    return this.createUser(
      'scryptMod',
      hashOptions,
      createUserDto.userId,
      createUserDto.email,
      createUserDto.password,
      createUserDto.phone,
      createUserDto.name,
    );
  }

  // TEMP MIGRATIONS
  async tempUndoMigrations() {
    return await this.dataSource.undoLastMigration();
  }

  // TEMP MIGRATIONS
  async tempDoMigrations() {
    return this.dataSource.runMigrations();
  }

  /**
   * Create a new target
   */
  async createTarget(userId: string, input: CreateTargetDto) {
    const targetId =
      input.targetId === 'unique()' ? ID.unique() : ID.custom(input.targetId);

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

    const user = await this.userRepo.findOneBy({ $id: userId });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const existingTarget = await this.targetRepo.findOneBy({ $id: targetId });
    if (existingTarget) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
    }

    const target = this.targetRepo.create({
      $id: targetId,
      $permissions: [
        Permission.Read(Role.User(userId)),
        Permission.Update(Role.User(userId)),
        Permission.Delete(Role.User(userId)),
      ],
      userId: user.$id,
      user: user,
      providerType: input.providerType,
      identifier: input.identifier,
      name: input.name,
    });

    await this.targetRepo.save(target);
    return target;
  }

  /**
   * Get all targets
   */
  async getTargets(userId: string) {
    const user = await this.userRepo.findOne({
      where: { $id: userId },
      relations: ['targets'],
    });
    console.log(user, user.targets);
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    let targets = await this.targetRepo.find();

    console.log(targets);

    return { total: user.targets.length, targets: user.targets };
  }

  /**
   * Update a target
   */
  async updateTarget(userId: string, targetId: string, input: UpdateTargetDto) {
    const target = await this.targetRepo.findOne({
      where: { $id: targetId, userId },
    });
    if (!target) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    if (input.identifier) {
      switch (target.providerType) {
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

      target.identifier = input.identifier;
    }

    if (input.providerId) {
      const provider = await this.providerRepo.findOne({
        where: { $id: input.providerId },
      });

      if (!provider) {
        throw new Exception(Exception.PROVIDER_NOT_FOUND);
      }

      if (provider.type !== target.providerType) {
        throw new Exception(Exception.PROVIDER_INCORRECT_TYPE);
      }

      target.providerId = provider.$id;
      target.provider = provider;
    }

    if (input.name) {
      target.name = input.name;
    }

    await this.targetRepo.save(target);
    return target;
  }

  /**
   * Get A target
   */
  async getTarget(userId: string, targetId: string) {
    const target = await this.targetRepo.findOne({
      where: { $id: targetId, userId },
    });
    if (!target) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    return target;
  }

  /**
   * Delete a target
   */
  async deleteTarget(userId: string, targetId: string) {
    const target = await this.targetRepo.findOne({
      where: { $id: targetId, userId },
    });
    if (!target) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    await this.targetRepo.remove(target);
    return {};
  }

  /**
   * Get all sessions
   */
  async getSessions(userId: string) {
    const user = await this.userRepo.findOne({
      where: { $id: userId },
      relations: ['sessions'],
    });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    return { total: user.sessions.length, sessions: user.sessions };
  }

  /**
   * Get all memberships
   */
  async getMemberships(userId: string) {
    const user = await this.userRepo.findOne({ where: { $id: userId } });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    let memberships = await this.memberRepo.find({
      where: { user: { id: user.id } },
      relations: ['team'],
    });

    for (let i = 0; i < memberships.length; i++) {
      memberships[i].userEmail = user.email;
      memberships[i].userName = user.name;
      memberships[i].teamName = memberships[i].team.name;
    }

    return { total: memberships.length, memberships };
  }

  /**
   * Get Mfa factors
   */
  async getMfaFactors(userId: string) {
    const user = await this.userRepo.findOne({
      where: { $id: userId },
      relations: ['authenticators'],
    });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const totp = await TOTP.getAuthenticatorFromUser(user);

    return {
      [MfaType.TOTP]: totp !== null && totp.verified,
      [MfaType.EMAIL]: user.email && user.emailVerification,
      [MfaType.PHONE]: user.phone && user.phoneVerification,
    };
  }

  /**
   * Get Mfa Recovery Codes
   */
  async getMfaRecoveryCodes(userId: string) {
    const user = await this.userRepo.findOne({ where: { $id: userId } });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    if (!user.mfaRecoveryCodes || user.mfaRecoveryCodes.length === 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND);
    }

    return {
      recoveryCodes: user.mfaRecoveryCodes,
    };
  }

  /**
   * Generate Mfa Recovery Codes
   */
  async generateMfaRecoveryCodes(userId: string) {
    const user = await this.userRepo.findOne({ where: { $id: userId } });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    if (user.mfaRecoveryCodes && user.mfaRecoveryCodes.length > 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_ALREADY_EXISTS);
    }

    user.mfaRecoveryCodes = MfaType.generateBackupCodes();
    await this.userRepo.save(user);

    return {
      recoveryCodes: user.mfaRecoveryCodes,
    };
  }

  /**
   * Regenerate Mfa Recovery Codes
   */
  async regenerateMfaRecoveryCodes(userId: string) {
    const user = await this.userRepo.findOne({ where: { $id: userId } });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    if (!user.mfaRecoveryCodes || user.mfaRecoveryCodes.length === 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND);
    }

    user.mfaRecoveryCodes = MfaType.generateBackupCodes();
    await this.userRepo.save(user);

    return {
      recoveryCodes: user.mfaRecoveryCodes,
    };
  }

  /**
   * Delete Mfa Authenticator
   */
  async deleteMfaAuthenticator(userId: string, type: string) {
    const user = await this.userRepo.findOne({
      where: { $id: userId },
      relations: { authenticators: true },
    });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    let authenticator = TOTP.getAuthenticatorFromUser(user);

    if (!authenticator) {
      throw new Exception(Exception.USER_AUTHENTICATOR_NOT_FOUND);
    }

    await this.authenticatorRepo.remove(authenticator);

    return {};
  }

  /**
   * Get all logs
   */
  async getLogs(userId: string) {
    return {
      logs: [],
      total: 0,
    };
  }

  /**
   * Get all identities
   */
  async getIdentities(queries: string[], search: string) {
    const query = new QueryBuilder(this.identityRepo, [
      'providerEmail',
      'userId',
    ]);

    query.parseQueryStrings(queries);

    const { results, totalCount } = await query.execute();
    return {
      identities: results,
      total: totalCount,
    };
  }

  /**
   * Delete an identity
   */
  async deleteIdentity(identityId: string) {
    const identity = await this.identityRepo.findOne({
      where: { $id: identityId },
    });
    if (!identity) {
      throw new Exception(Exception.USER_IDENTITY_NOT_FOUND);
    }

    await this.identityRepo.remove(identity);

    return {};
  }

  /**
   * Create a new Token
   */
  async createToken(
    userId: string,
    input: CreateTokenDto,
    context: { ip: string; ua: string },
  ) {
    const user = await this.userRepo.findOne({ where: { $id: userId } });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const secret = Auth.tokenGenerator(input.length);
    const expire = new Date(Date.now() + input.expire * 1000);

    const token = this.tokenRepo.create({
      $id: ID.unique(),
      userId: user.$id,
      user: user,
      type: Auth.TOKEN_TYPE_GENERIC,
      secret: Auth.hash(secret),
      expire: expire,
      userAgent: context.ua,
      ip: context.ip,
    });

    await this.tokenRepo.save(token);

    token.secret = secret;

    return token;
  }

  /**
   * Create Jwt
   */
  async createJwt(userId: string, input: CreateJwtDto) {
    const user = await this.userRepo.findOne({
      where: { $id: userId },
      relations: { sessions: true },
    });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    let session: SessionEntity | undefined;

    if (input.sessionId === 'recent') {
      session = user.sessions.length > 0 ? user.sessions.at(-1) : undefined;
    } else {
      for (let sess of user.sessions) {
        if (input.sessionId === sess.$id) {
          session = sess;
        }
      }
    }

    return {
      jwt: this.jwtService.sign(
        { userId: user.$id, sessionId: session ? session.$id : '' },
        { expiresIn: input.duration },
      ),
    };
  }

  /**
   * Create User Session
   */
  async createSession(userId: string, req: Request) {
    const project = this.cls.get<ProjectDocument>(PROJECT);
    const user = await this.userRepo.findOne({ where: { $id: userId } });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION);
    const detector = new Detector(req.headers['user-agent']);

    const duration = project.auths.duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG;
    const expire = new Date(Date.now() + duration * 1000);

    const session = this.sessionRepo.create({
      $id: ID.unique(),
      $permissions: [
        Permission.Read(Role.User(userId)),
        Permission.Update(Role.User(userId)),
        Permission.Delete(Role.User(userId)),
      ],
      provider: Auth.SESSION_PROVIDER_SERVER,
      secret: Auth.hash(secret),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: user.$id,
      user: user,
      countryCode: '--' /**@todo: Get Country using geodb */,
      expire: expire,
      ...detector.getOS(),
      ...detector.getClient(),
      ...detector.getDevice(),
    });

    await this.sessionRepo.save(session);

    let countryName = '';

    session.secret = secret;
    session.countryName = countryName;

    return session;
  }

  /**
   * Delete User Session
   */
  async deleteSession(userId: string, sessionId: string) {
    const session = await this.sessionRepo.findOne({
      where: { $id: sessionId, userId },
    });
    if (!session) {
      throw new Exception(Exception.USER_SESSION_NOT_FOUND);
    }

    await this.sessionRepo.remove(session);

    return {};
  }

  /**
   * Delete User Sessions
   */
  async deleteSessions(userId: string) {
    const user = await this.userRepo.findOne({
      where: { $id: userId },
      relations: ['sessions'],
    });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    await this.sessionRepo.remove(user.sessions);

    return {};
  }

  /**
   * Delete User
   */
  async remove(userId: string) {
    const user = await this.userRepo.findOne({ where: { $id: userId } });
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    await this.userRepo.remove(user);

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
    hash: string,
    hashOptions: any,
    userId: string,
    email: string | null,
    password: string | null,
    phone: string | null,
    name: string,
  ): Promise<UserEntity> {
    const project: ProjectDocument = this.cls.get(PROJECT);

    const plaintextPassword = password;
    const hashOptionsObject =
      typeof hashOptions === 'string' ? JSON.parse(hashOptions) : hashOptions;
    const passwordHistory = project.auths?.passwordHistory ?? 0;

    if (email) {
      email = email.toLowerCase();

      // Ensure this email is not already used in another identity
      const identityWithMatchingEmail = await this.identityRepo.findOne({
        where: {
          providerEmail: email,
        },
      });
      if (identityWithMatchingEmail) {
        throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS);
      }
    }

    try {
      userId = userId === 'unique()' ? ID.unique() : ID.custom(userId);

      if (project.auths?.personalDataCheck ?? false) {
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

      const user = this.userRepo.create({
        $id: userId,
        $permissions: [
          Permission.Read(Role.Any()),
          Permission.Update(Role.User(userId)),
          Permission.Delete(Role.User(userId)),
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

      // if (hash === 'plaintext') {
      //   await hooks.trigger('passwordValidator', [dbForProject, project, plaintextPassword, user, true]);
      // }

      const createdUser = await this.userRepo.save(user);

      if (email) {
        try {
          const target = this.targetRepo.create({
            $id: ID.unique(),
            $permissions: [
              Permission.Read(Role.User(createdUser.$id)),
              Permission.Update(Role.User(createdUser.$id)),
              Permission.Delete(Role.User(createdUser.$id)),
            ],
            userId: createdUser.$id,
            user: createdUser,
            providerType: 'email',
            identifier: email,
          });

          await this.targetRepo.save(target);
        } catch (error) {
          if (error instanceof QueryFailedError) {
            const existingTarget = await this.targetRepo.findOne({
              where: {
                identifier: email,
              },
            });
            if (existingTarget) {
              existingTarget.user = createdUser;
              await this.targetRepo.save(existingTarget);
            }
          } else throw error;
        }
      }

      if (phone) {
        try {
          const target = this.targetRepo.create({
            $id: ID.unique(),
            $permissions: [
              Permission.Read(Role.User(createdUser.$id)),
              Permission.Update(Role.User(createdUser.$id)),
              Permission.Delete(Role.User(createdUser.$id)),
            ],
            userId: createdUser.$id,
            user: createdUser,
            providerType: 'sms',
            identifier: phone,
          });

          await this.targetRepo.save(target);
        } catch (error) {
          if (error instanceof QueryFailedError) {
            const existingTarget = await this.targetRepo.findOne({
              where: {
                identifier: phone,
              },
            });
            if (existingTarget) {
              existingTarget.user = createdUser;
              await this.targetRepo.save(existingTarget);
            }
          } else throw error;
        }
      }

      // queueForEvents.setParam('userId', userId);
      return createdUser;
    } catch (error) {
      this.logger.error(error);
      if (error instanceof QueryFailedError) {
        throw new Exception(Exception.USER_ALREADY_EXISTS);
      } else throw error;
    }
  }

  /**
   * Get usage statistics
   * @todo .....
   */
  async getUsage(range: string = '1d') {
    const periods = {
      '1d': { limit: 24, period: '1h', factor: 3600 },
      '7d': { limit: 7, period: '1d', factor: 86400 },
    };
    const stats = {};
    const usage = {} as any;
    const days = periods[range];
    const metrics = ['users', 'sessions'];

    for (const metric of metrics) {
      const totalResult = await this.statsRepo.findOne({
        where: { metric, period: 'inf' },
      });
      stats[metric] = { total: totalResult?.value ?? 0, data: {} };

      const results = await this.statsRepo.find({
        where: { metric, period: days.period },
        order: { time: 'DESC' },
        take: days.limit,
      });

      for (const result of results) {
        stats[metric].data[result.time] = { value: result.value };
      }
    }

    const format =
      days.period === '1h' ? 'Y-m-d\TH:00:00.000P' : 'Y-m-d\T00:00:00.000P';

    for (const metric of metrics) {
      usage[metric] = { total: stats[metric].total, data: [] };
      let leap = Date.now() - days.limit * days.factor * 1000;

      while (leap < Date.now()) {
        leap += days.factor * 1000;
        const formatDate = new Date(leap).toISOString();
        usage[metric].data.push({
          value: stats[metric].data[formatDate]?.value ?? 0,
          date: formatDate,
        });
      }
    }

    return {
      range,
      usersTotal: usage?.users?.total,
      sessionsTotal: usage?.sessions?.total,
      users: usage?.users?.data,
      sessions: usage?.sessions?.data,
    };
  }
}
