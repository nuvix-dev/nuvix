import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { TargetEntity } from 'src/core/entities/messages/target.entity';
import { IdentityEntity } from 'src/core/entities/users/identity.entity';
import { UserEntity } from 'src/core/entities/users/user.entity';
import { Exception } from 'src/core/extend/exception';
import { ID } from 'src/core/helper/ID.helper';
import Permission from 'src/core/helper/permission.helper';
import Role from 'src/core/helper/role.helper';
import { PersonalDataValidator } from 'src/core/validators/personal-data.validator';
import { ProjectDocument } from 'src/projects/schemas/project.schema';
import { DataSource, Repository } from 'typeorm';
import { CreateUserDto, CreateUserWithScryptDto, CreateUserWithScryptModifedDto, CreateUserWithShaDto } from './dto/user.dto';
import { ClsService } from 'nestjs-cls';
import { PROJECT } from 'src/Utils/constants';
import { Auth } from 'src/core/helper/auth.helper';
import { CreateTargetDto } from './dto/target.dto';
import { EmailValidator } from 'src/core/validators/email.validator';
import { PhoneValidator } from 'src/core/validators/phone.validator';

@Injectable()
export class UsersService {
  private logger: Logger = new Logger(UsersService.name)
  private userRepo: Repository<UserEntity>;
  private readonly identityRepo: Repository<IdentityEntity>;
  private readonly targetRepo: Repository<TargetEntity>;

  constructor(
    @Inject('CONNECTION') private readonly dataSource: DataSource,
    private readonly cls: ClsService,
  ) {
    this.userRepo = this.dataSource.getRepository(UserEntity);
    this.identityRepo = this.dataSource.getRepository(IdentityEntity);
    this.targetRepo = this.dataSource.getRepository(TargetEntity);
  }

  /**
   * Find all users
   */
  async findAll(queries: string[], search: string) {
    const users = await this.userRepo.findAndCount()
    return {
      users: users[0],
      total: users[1],
    }
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

  async createTarget(userId: string, input: CreateTargetDto) {
    const targetId = input.targetId === 'unique()' ? ID.unique() : ID.custom(input.targetId);

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
    user.targets.push(target);
    return target;
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
    const hashOptionsObject = typeof hashOptions === 'string' ? JSON.parse(hashOptions) : hashOptions;
    const passwordHistory = project.auths?.passwordHistory ?? 0;

    if (email) {
      email = email.toLowerCase();

      // Ensure this email is not already used in another identity
      const identityWithMatchingEmail = await this.identityRepo.findOne({
        where: {
          providerEmail: email
        }
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
          true // allowEmpty
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
        hashOptions: hash === 'plaintext' ? Auth.DEFAULT_ALGO_OPTIONS : { ...hashOptionsObject, type: hash },
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
          createdUser.targets.push(target);
        } catch (error) {
          const existingTarget = await this.targetRepo.findOne({
            where: {
              identifier: email
            }
          });
          if (existingTarget) {
            createdUser.targets.push(existingTarget);
          }
        }
      }

      if (phone) {
        try {
          const target = this.targetRepo.create({
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
          createdUser.targets.push(target);
        } catch (error) {
          const existingTarget = await this.targetRepo.findOne({
            where: {
              identifier: phone
            }
          });
          if (existingTarget) {
            createdUser.targets.push(existingTarget)
          }
        }
      }

      // queueForEvents.setParam('userId', userId);
      return createdUser;

    } catch (error) {
      throw new Exception(Exception.USER_ALREADY_EXISTS)
    }
  }


}
