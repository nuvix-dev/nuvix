import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Database } from '@nuvix/db';
import {
  AuditEvent,
  AuthType,
  Route,
  Scope,
  Sdk,
  Throttle,
} from '@nuvix/core/decorators';
import { Locale } from '@nuvix/core/decorators/locale.decorator';
import { ResModel } from '@nuvix/core/decorators/res-model.decorator';
import {
  AuthDatabase,
  Project,
} from '@nuvix/core/decorators/project.decorator';
import { User } from '@nuvix/core/decorators/project-user.decorator';
import { Exception } from '@nuvix/core/extend/exception';
import { LocaleTranslator } from '@nuvix/core/helper/locale.helper';
import { Models } from '@nuvix/core/helper/response.helper';
import { Public } from '@nuvix/core/resolvers/guards/auth.guard';
import { ProjectGuard } from '@nuvix/core/resolvers/guards';
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { AccountService } from './account.service';
import {
  CreateAccountDTO,
  UpdateEmailDTO,
  UpdateNameDTO,
  UpdatePasswordDTO,
  UpdatePhoneDTO,
  UpdatePrefsDTO,
} from './DTO/account.dto';
import {
  CreateEmailVerificationDTO,
  UpdateEmailVerificationDTO,
  UpdatePhoneVerificationDTO,
} from './DTO/verification.dto';
import type { ProjectsDoc, UsersDoc } from '@nuvix/utils/types';

@Controller({ version: ['1'], path: 'account' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Public()
  @Post()
  @Scope('sessions.create')
  @Route()
  @ResModel(Models.ACCOUNT)
  @Throttle(10)
  @AuditEvent('user.create', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  async createAccount(
    @AuthDatabase() db: Database,
    @Body() input: CreateAccountDTO,
    @User() user: UsersDoc,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.createAccount(
      db,
      input.userId,
      input.email,
      input.password,
      input.name,
      user,
      project,
    );
  }

  @Route({
    scopes: 'account',
    auth: AuthType.SESSION,
    resModel: Models.ACCOUNT,
  })
  @ResModel(Models.ACCOUNT)
  async getAccount(@User() user: UsersDoc) {
    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }
    return user;
  }

  @Delete()
  @Scope('account')
  @Route()
  @ResModel(Models.NONE)
  @AuditEvent('user.delete', 'user/{res.$id}')
  async deleteAccount(@AuthDatabase() db: Database, @User() user: UsersDoc) {
    return this.accountService.deleteAccount(db, user);
  }

  @Route({
    method: 'POST',
    path: ['jwts', 'jwt'],
    scopes: 'account',
    auth: AuthType.JWT,
    throttle: {
      limit: 100,
      key: 'userId:{userId}',
    },
    sdk: {
      name: 'createJWT',
    },
  })
  async createJWT(
    @User() user: UsersDoc,
    @Res({ passthrough: true }) response: NuvixRes,
  ) {
    return this.accountService.createJWT(user, response);
  }

  @Get('prefs')
  @Scope('account')
  @Route()
  @ResModel(Models.PREFERENCES)
  getPrefs(@User() user: UsersDoc) {
    return user.get('prefs', {});
  }

  @Patch('prefs')
  @Scope('account')
  @Route()
  @ResModel(Models.PREFERENCES)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updatePrefs(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: UpdatePrefsDTO,
  ) {
    return this.accountService.updatePrefs(db, user, input.prefs);
  }

  @Patch('name')
  @Scope('account')
  @ResModel(Models.ACCOUNT)
  @AuditEvent('user.update', 'user/{res.$id}')
  @Sdk({
    name: 'updateName',
  })
  async updateName(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() { name }: UpdateNameDTO,
  ) {
    return this.accountService.updateName(db, name, user);
  }

  @Patch('password')
  @Scope('account')
  @Throttle(10)
  @ResModel(Models.ACCOUNT)
  @AuditEvent('user.update', 'user/{res.$id}')
  @Sdk({
    name: 'updatePassword',
  })
  async updatePassword(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() { password, oldPassword }: UpdatePasswordDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.updatePassword({
      db: db,
      password,
      oldPassword,
      user,
      project,
    });
  }

  @Patch('email')
  @Scope('account')
  @Route()
  @ResModel(Models.ACCOUNT)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updateEmail(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() updateEmailDTO: UpdateEmailDTO,
  ) {
    return this.accountService.updateEmail(db, user, updateEmailDTO);
  }

  @Patch('phone')
  @Scope('account')
  @ResModel(Models.ACCOUNT)
  @AuditEvent('user.update', 'user/{res.$id}')
  @Sdk({
    name: 'updatePhone',
  })
  async updatePhone(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() { password, phone }: UpdatePhoneDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.updatePhone({
      db: db,
      password,
      phone,
      user,
      project,
    });
  }

  @Patch('status')
  @Scope('account')
  @ResModel(Models.ACCOUNT)
  @AuditEvent('user.update', 'user/{res.$id}')
  @Sdk({
    name: 'updateStatus',
  })
  async updateStatus(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
  ) {
    return this.accountService.updateStatus({
      db: db,
      user,
      request,
      response,
    });
  }

  @Post('verification')
  @Scope('account')
  @Throttle({
    limit: 10,
    key: 'ip:{ip},userId:{param-userId}',
  })
  @AuditEvent('verification.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @ResModel(Models.TOKEN)
  @Sdk({
    name: 'createVerification',
  })
  async createEmailVerification(
    @Body() { url }: CreateEmailVerificationDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Project() project: ProjectsDoc,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.createEmailVerification({
      url,
      request,
      response,
      project,
      user,
      db,
      locale,
    });
  }

  @Public()
  @Put('verification')
  @Scope('public')
  @Throttle({
    limit: 10,
    key: 'ip:{ip},userId:{param-userId}',
  })
  @AuditEvent('verification.update', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @ResModel(Models.TOKEN)
  @Sdk({
    name: 'updateEmailVerification',
  })
  async updateEmailVerification(
    @Body() { userId, secret }: UpdateEmailVerificationDTO,
    @Res({ passthrough: true }) response: NuvixRes,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
  ) {
    return this.accountService.updateEmailVerification({
      userId,
      secret,
      response,
      user,
      db,
    });
  }

  @Post('verification/phone')
  @Scope('account')
  @Throttle({
    limit: 10,
    key: 'ip:{ip},userId:{param-userId}',
  })
  @AuditEvent('verification.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @ResModel(Models.TOKEN)
  @Sdk({
    name: 'createPhoneVerification',
  })
  async createPhoneVerification(
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Project() project: ProjectsDoc,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.createPhoneVerification({
      request,
      response,
      user,
      db,
      project,
      locale,
    });
  }

  @Public()
  @Put('verification/phone')
  @Scope('public')
  @Throttle({
    limit: 10,
    key: 'ip:{ip},userId:{param-userId}',
  })
  @AuditEvent('verification.update', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @ResModel(Models.TOKEN)
  @Sdk({
    name: 'updatePhoneVerification',
  })
  async updatePhoneVerification(
    @Body() { userId, secret }: UpdatePhoneVerificationDTO,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
  ) {
    return this.accountService.updatePhoneVerification({
      userId,
      secret,
      user,
      db,
    });
  }
}
