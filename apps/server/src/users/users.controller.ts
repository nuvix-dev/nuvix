import {
  Body,
  Controller,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { AuditDoc } from '@nuvix/audit'
import { Delete, Get, Patch, Post, Put } from '@nuvix/core'
import {
  Auth,
  AuthDatabase,
  AuthType,
  Locale,
  Namespace,
  Project,
  QueryFilter,
  QuerySearch,
} from '@nuvix/core/decorators'
import type { LocaleTranslator } from '@nuvix/core/helpers'
import { Models } from '@nuvix/core/helpers'
import {
  IdentitiesQueryPipe,
  LogsQueryPipe,
  MembershipsQueryPipe,
  UsersQueryPipe,
} from '@nuvix/core/pipes/queries'
import {
  ApiInterceptor,
  ProjectGuard,
  ResponseInterceptor,
} from '@nuvix/core/resolvers'
import type { Database, Query as Queries } from '@nuvix/db'
import type { IListResponse, IResponse } from '@nuvix/utils'
import type {
  IdentitiesDoc,
  MembershipsDoc,
  ProjectsDoc,
  TokensDoc,
  UsersDoc,
} from '@nuvix/utils/types'
import { CreateJwtDTO } from './DTO/jwt.dto'
import { CreateTokenDTO } from './DTO/token.dto'
import {
  CreateUserDTO,
  CreateUserWithScryptDTO,
  CreateUserWithScryptModifedDTO,
  CreateUserWithShaDTO,
  IdentityParamDTO,
  RangeQueryDTO,
  UpdateUserEmailDTO,
  UpdateUserEmailVerificationDTO,
  UpdateUserLabelDTO,
  UpdateUserNameDTO,
  UpdateUserPasswordDTO,
  UpdateUserPhoneDTO,
  UpdateUserPoneVerificationDTO,
  UpdateUserPrefsDTO,
  UpdateUserStatusDTO,
  UserParamDTO,
} from './DTO/user.dto'
import { UsersService } from './users.service'

@Namespace('users')
@Controller({ version: ['1'], path: 'users' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.ADMIN, AuthType.KEY])
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('', {
    summary: 'Create user',
    scopes: 'users.create',
    model: Models.USER,
    audit: {
      key: 'user.create',
      resource: 'user/{res.$id}',
    },
    sdk: {
      name: 'create',
      descMd: '/docs/references/users/create-user.md',
    },
  })
  async create(
    @Body() createUserDTO: CreateUserDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.create(db, createUserDTO, project)
  }

  @Post('argon2', {
    summary: 'Create user with Argon2 password',
    scopes: 'users.create',
    model: Models.USER,
    audit: {
      key: 'user.create',
      resource: 'user/{res.$id}',
    },
    sdk: {
      name: 'createArgon2User',
      descMd: '/docs/references/users/create-argon2-user.md',
    },
  })
  async createWithArgon2(
    @Body() createUserDTO: CreateUserDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.createWithArgon2(db, createUserDTO, project)
  }

  @Post('bcrypt', {
    summary: 'Create user with bcrypt password',
    scopes: 'users.create',
    model: Models.USER,
    audit: {
      key: 'user.create',
      resource: 'user/{res.$id}',
    },
    sdk: {
      name: 'createBcryptUser',
      descMd: '/docs/references/users/create-bcrypt-user.md',
    },
  })
  async createWithBcrypt(
    @Body() createUserDTO: CreateUserDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.createWithBcrypt(db, createUserDTO, project)
  }

  @Post('md5', {
    summary: 'Create user with MD5 password',
    scopes: 'users.create',
    model: Models.USER,
    audit: {
      key: 'user.create',
      resource: 'user/{res.$id}',
    },
    sdk: {
      name: 'createMD5User',
      descMd: '/docs/references/users/create-md5-user.md',
    },
  })
  async createWithMd5(
    @Body() createUserDTO: CreateUserDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.createWithMd5(db, createUserDTO, project)
  }

  @Post('sha', {
    summary: 'Create user with SHA password',
    scopes: 'users.create',
    model: Models.USER,
    audit: {
      key: 'user.create',
      resource: 'user/{res.$id}',
    },
    sdk: {
      name: 'createSHAUser',
      descMd: '/docs/references/users/create-sha-user.md',
    },
  })
  async createWithSha(
    @Body() createUserDTO: CreateUserWithShaDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.createWithSha(db, createUserDTO, project)
  }

  @Post('phpass', {
    summary: 'Create user with PHPass password',
    scopes: 'users.create',
    model: Models.USER,
    audit: {
      key: 'user.create',
      resource: 'user/{res.$id}',
    },
    sdk: {
      name: 'createPHPassUser',
      descMd: '/docs/references/users/create-phpass-user.md',
      deprecated: true, // -------
    },
  })
  async createWithPhpass(
    @Body() createUserDTO: CreateUserDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.createWithPhpass(db, createUserDTO, project)
  }

  @Post('scrypt', {
    summary: 'Create user with Scrypt password',
    scopes: 'users.create',
    model: Models.USER,
    audit: {
      key: 'user.create',
      resource: 'user/{res.$id}',
    },
    sdk: {
      name: 'createScryptUser',
      descMd: '/docs/references/users/create-scrypt-user.md',
    },
  })
  async createWithScrypt(
    @Body() createUserDTO: CreateUserWithScryptDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.createWithScrypt(db, createUserDTO, project)
  }

  @Post('scrypt-modified', {
    summary: 'Create user with Scrypt modified password',
    scopes: 'users.create',
    model: Models.USER,
    audit: {
      key: 'user.create',
      resource: 'user/{res.$id}',
    },
    sdk: {
      name: 'createScryptModifiedUser',
      descMd: '/docs/references/users/create-scrypt-modified-user.md',
    },
  })
  async createWithScryptModified(
    @Body() createUserDTO: CreateUserWithScryptModifedDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.createWithScryptMod(db, createUserDTO, project)
  }

  @Get('', {
    summary: 'List users',
    scopes: 'users.read',
    model: {
      type: Models.USER,
      list: true,
    },
    sdk: {
      name: 'list',
      descMd: '/docs/references/users/list-users.md',
    },
  })
  async findAll(
    @QueryFilter(UsersQueryPipe) queries?: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<UsersDoc>> {
    return this.usersService.findAll(db, queries, search)
  }

  @Get('usage', {
    summary: 'Get users usage stats',
    scopes: 'users.read',
    auth: AuthType.ADMIN,
    model: Models.USAGE_USERS,
    sdk: {
      name: 'getUsage',
      descMd: '/docs/references/users/get-usage.md',
    },
  })
  async getUsage(
    @Query() { range }: RangeQueryDTO,
  ): Promise<IResponse<unknown>> {
    return this.usersService.getUsage(db, range)
  }

  @Get('identities', {
    summary: 'List identities',
    scopes: 'users.read',
    model: { type: Models.IDENTITY, list: true },
    sdk: {
      name: 'listIdentities',
      descMd: '/docs/references/users/list-identities.md',
    },
  })
  async getIdentities(
    @QueryFilter(IdentitiesQueryPipe) queries?: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<IdentitiesDoc>> {
    return this.usersService.getIdentities(db, queries, search)
  }

  @Delete('identities/:identityId', {
    summary: 'Delete identity',
    scopes: 'users.update',
    model: Models.NONE,
    audit: {
      key: 'identity.delete',
      resource: 'identity/{params.identityId}',
    },
    sdk: {
      name: 'deleteIdentity',
      descMd: '/docs/references/users/delete-identity.md',
    },
  })
  async deleteIdentity(
    @Param() { identityId }: IdentityParamDTO,
  ): Promise<void> {
    return this.usersService.deleteIdentity(db, identityId)
  }

  @Get(':userId', {
    summary: 'Get user',
    scopes: 'users.read',
    model: Models.USER,
    sdk: {
      name: 'get',
      descMd: '/docs/references/users/get-user.md',
    },
  })
  async findOne(
    @Param() { userId }: UserParamDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.findOne(db, userId)
  }

  @Get(':userId/prefs', {
    summary: 'Get user preferences',
    scopes: 'users.read',
    model: Models.PREFERENCES,
    sdk: {
      name: 'getPrefs',
      descMd: '/docs/references/users/get-user-prefs.md',
    },
  })
  async getPrefs(
    @Param() { userId }: UserParamDTO,
  ): Promise<IResponse<Record<string, unknown>>> {
    return this.usersService.getPrefs(db, userId)
  }

  @Patch(':userId/prefs', {
    summary: 'Update user preferences',
    scopes: 'users.update',
    model: Models.PREFERENCES,
    sdk: {
      name: 'updatePrefs',
      descMd: '/docs/references/users/update-user-prefs.md',
    },
  })
  async updatePrefs(
    @Param() { userId }: UserParamDTO,
    @Body() { prefs }: UpdateUserPrefsDTO,
  ): Promise<IResponse<Record<string, unknown>>> {
    return this.usersService.updatePrefs(db, userId, prefs)
  }

  @Patch(':userId/status', {
    summary: 'Update user status',
    scopes: 'users.update',
    model: Models.USER,
    audit: {
      key: 'user.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'updateStatus',
      descMd: '/docs/references/users/update-user-status.md',
    },
  })
  async updateStatus(
    @Param() { userId }: UserParamDTO,
    @Body() status: UpdateUserStatusDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.updateStatus(db, userId, status)
  }

  @Put(':userId/labels', {
    summary: 'Update user labels',
    scopes: 'users.update',
    model: Models.USER,
    audit: {
      key: 'user.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'updateLabels',
      descMd: '/docs/references/users/update-user-labels.md',
    },
  })
  async updateLabels(
    @Param() { userId }: UserParamDTO,
    @Body() input: UpdateUserLabelDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.updateLabels(db, userId, input)
  }

  @Patch(':userId/name', {
    summary: 'Update name',
    scopes: 'users.update',
    model: Models.USER,
    audit: {
      key: 'user.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'updateName',
      descMd: '/docs/references/users/update-user-name.md',
    },
  })
  async updateName(
    @Param() { userId }: UserParamDTO,
    @Body() input: UpdateUserNameDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.updateName(db, userId, input)
  }

  @Patch(':userId/password', {
    summary: 'Update password',
    scopes: 'users.update',
    model: Models.USER,
    audit: {
      key: 'user.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'updatePassword',
      descMd: '/docs/references/users/update-user-password.md',
    },
  })
  async updatePassword(
    @Param() { userId }: UserParamDTO,
    @Body() input: UpdateUserPasswordDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.updatePassword(db, userId, input, project)
  }

  @Patch(':userId/email', {
    summary: 'Update email',
    scopes: 'users.update',
    model: Models.USER,
    audit: {
      key: 'user.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'updateEmail',
      descMd: '/docs/references/users/update-user-email.md',
    },
  })
  async updateEmail(
    @Param() { userId }: UserParamDTO,
    @Body() input: UpdateUserEmailDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.updateEmail(db, userId, input.email)
  }

  @Patch(':userId/phone', {
    summary: 'Update phone',
    scopes: 'users.update',
    model: Models.USER,
    audit: {
      key: 'user.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'updatePhone',
      descMd: '/docs/references/users/update-user-phone.md',
    },
  })
  async updatePhone(
    @Param() { userId }: UserParamDTO,
    @Body() input: UpdateUserPhoneDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.updatePhone(db, userId, input.phone)
  }

  @Post(':userId/jwts', {
    summary: 'Create user JWT',
    scopes: 'users.update',
    model: Models.JWT,
    sdk: {
      name: 'createJWT',
      descMd: '/docs/references/users/create-user-jwt.md',
    },
  })
  async createJwt(
    @Param() { userId }: UserParamDTO,
    @Body() input: CreateJwtDTO,
  ): Promise<IResponse<{ jwt: string }>> {
    return this.usersService.createJwt(db, userId, input)
  }

  @Get(':userId/memberships', {
    summary: 'List user memberships',
    scopes: 'users.read',
    model: {
      type: Models.MEMBERSHIP,
      list: true,
    },
    sdk: {
      name: 'listMemberships',
      descMd: '/docs/references/users/list-user-memberships.md',
    },
  })
  async getMemberships(
    @Param() { userId }: UserParamDTO,
    @QueryFilter(MembershipsQueryPipe) queries?: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<MembershipsDoc>> {
    return this.usersService.getMemberships(db, userId, queries, search)
  }

  @Post(':userId/tokens', {
    summary: 'Create token',
    scopes: 'users.update',
    model: Models.TOKEN,
    audit: {
      key: 'tokens.create',
      resource: 'user/{params.userId}',
    },
    sdk: {
      name: 'createToken',
      descMd: '/docs/references/users/create-token.md',
    },
  })
  async createToken(
    @Param() { userId }: UserParamDTO,
    @Body() input: CreateTokenDTO,
    @Req() req: NuvixRequest,
  ): Promise<IResponse<TokensDoc>> {
    return this.usersService.createToken(
      db,
      userId,
      input,
      req.headers['user-agent'] ?? 'UNKNOWN',
      req.ip,
    )
  }

  @Get(':userId/logs', {
    summary: 'List user logs',
    scopes: 'users.read',
    model: {
      type: Models.LOG,
      list: true,
    },
    sdk: {
      name: 'listLogs',
      descMd: '/docs/references/users/list-user-logs.md',
    },
  })
  async getLogs(
    @Param() { userId }: UserParamDTO,
    @Locale() locale: LocaleTranslator,
    @QueryFilter(LogsQueryPipe) queries?: Queries[],
  ): Promise<IListResponse<AuditDoc>> {
    return this.usersService.getLogs(db, userId, locale, queries)
  }

  @Patch(':userId/verification', {
    summary: 'Update phone verification',
    scopes: 'users.update',
    model: Models.USER,
    audit: {
      key: 'verification.update',
      resource: 'user/{res.$id}',
    },
    sdk: {
      name: 'updateEmailVerification',
      descMd: '/docs/references/users/update-user-email-verification.md',
    },
  })
  async verify(
    @Param() { userId }: UserParamDTO,
    @Body() input: UpdateUserEmailVerificationDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.updateEmailVerification(db, userId, input)
  }

  @Patch(':userId/verification/phone', {
    summary: 'Update phone verification',
    scopes: 'users.update',
    model: Models.USER,
    audit: {
      key: 'verification.update',
      resource: 'user/{res.$id}',
    },
    sdk: {
      name: 'updatePhoneVerification',
      descMd: '/docs/references/users/update-user-phone-verification.md',
    },
  })
  async verifyPhone(
    @Param() { userId }: UserParamDTO,
    @Body() input: UpdateUserPoneVerificationDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.usersService.updatePhoneVerification(db, userId, input)
  }

  @Delete(':userId', {
    summary: 'Delete user',
    scopes: 'users.delete',
    audit: {
      key: 'user.delete',
      resource: 'user/{params.usersId}',
    },
    sdk: {
      name: 'delete',
      descMd: '/docs/references/users/delete.md',
    },
  })
  async remove(@Param() { userId }: UserParamDTO): Promise<void> {
    return this.usersService.remove(db, userId, project)
  }
}
