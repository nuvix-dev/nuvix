import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  Session,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { Database } from '@nuvix-tech/db';
import { Query as Queries } from '@nuvix-tech/db';

import {
  AuditEvent,
  AuthType,
  Label,
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
import { IdentityIdParamDTO } from './DTO/identity.dto';
import {
  CreateMfaChallengeDTO,
  MfaAuthenticatorTypeParamDTO,
  UpdateAccountMfaDTO,
  VerifyMfaChallengeDTO,
  VerifyMfaAuthenticatorDTO,
} from './DTO/mfa.dto';
import { CreateRecoveryDTO, UpdateRecoveryDTO } from './DTO/recovery.dto';
import {
  CreateEmailSessionDTO,
  CreateOAuth2SessionDTO,
  CreateSessionDTO,
  OAuth2CallbackDTO,
  ProviderParamDTO,
} from './DTO/session.dto';
import {
  CreatePushTargetDTO,
  TargetIdParamDTO,
  UpdatePushTargetDTO,
} from './DTO/target.dto';
import {
  CreateEmailTokenDTO,
  CreateMagicURLTokenDTO,
  CreateOAuth2TokenDTO,
  CreatePhoneTokenDTO,
} from './DTO/token.dto';
import {
  CreateEmailVerificationDTO,
  UpdateEmailVerificationDTO,
  UpdatePhoneVerificationDTO,
} from './DTO/verification.dto';
import type { ProjectsDoc, SessionsDoc, UsersDoc } from '@nuvix/utils/types';
import { IdentitiesQueryPipe } from '@nuvix/core/pipes/queries';

@Controller({ version: ['1'], path: 'account' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Public()
  @Post()
  @Scope('sessions.create')
  @Label('res.status', 'CREATED')
  @Label('res.type', 'JSON')
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

  @Get()
  @Scope('account')
  @Label('res.status', 'OK')
  @Label('res.type', 'JSON')
  @ResModel(Models.ACCOUNT)
  async getAccount(@User() user: UsersDoc) {
    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }
    return user;
  }

  @Delete()
  @Scope('account')
  @Label('res.status', 'NO_CONTENT')
  @Label('res.type', 'JSON')
  @ResModel(Models.NONE)
  @AuditEvent('user.delete', 'user/{res.$id}')
  async deleteAccount(@AuthDatabase() db: Database, @User() user: UsersDoc) {
    return this.accountService.deleteAccount(db, user);
  }

  @Get('sessions')
  @Scope('account')
  @Label('res.status', 'OK')
  @Label('res.type', 'JSON')
  @ResModel(Models.SESSION, { list: true })
  async getSessions(
    @User() user: UsersDoc,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.getSessions(user, locale);
  }

  @Delete('sessions')
  @Scope('account')
  @Label('res.status', 'NO_CONTENT')
  @Label('res.type', 'JSON')
  @ResModel(Models.NONE)
  @Throttle(100)
  @AuditEvent('session.delete', 'user/{user.$id}')
  async deleteSessions(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.deleteSessions(
      db,
      user,
      locale,
      request,
      response,
    );
  }

  @Get('sessions/:id')
  @Scope('account')
  @Label('res.status', 'OK')
  @Label('res.type', 'JSON')
  @ResModel(Models.SESSION)
  async getSession(
    @User() user: UsersDoc,
    @Param('id') sessionId: string,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.getSession(user, sessionId, locale);
  }

  @Delete('sessions/:id')
  @Scope('account')
  @Label('res.status', 'NO_CONTENT')
  @Label('res.type', 'JSON')
  @ResModel(Models.NONE)
  @Throttle(100)
  @AuditEvent('session.delete', 'user/{user.$id}')
  async deleteSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Param('id') id: string,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.deleteSession(
      db,
      user,
      id,
      request,
      response,
      locale,
    );
  }

  @Patch('sessions/:id')
  @Scope('account')
  @Label('res.status', 'OK')
  @Label('res.type', 'JSON')
  @ResModel(Models.SESSION)
  @Throttle(10)
  @AuditEvent('session.update', 'user/{res.userId}')
  async updateSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Param('id') id: string,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.updateSession(db, user, id, project);
  }

  @Public()
  @Post(['sessions/email', 'sessions'])
  @Scope('sessions.create')
  @Label('res.status', 'CREATED')
  @Label('res.type', 'JSON')
  @ResModel(Models.SESSION)
  @Throttle({
    limit: 10,
    key: 'email:{param-email}',
  })
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  async createEmailSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateEmailSessionDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.createEmailSession(
      db,
      user,
      input,
      request,
      response,
      locale,
      project,
    );
  }

  @Public()
  @Post('sessions/anonymous')
  @Scope('sessions.create')
  @ResModel(Models.SESSION)
  @Throttle({
    limit: 50,
    key: 'ip:{ip}',
  })
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'createAnonymousSession',
  })
  async createAnonymousSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.createAnonymousSession({
      user,
      request,
      response,
      locale,
      project,
      db: db,
    });
  }

  @Public()
  @Post('sessions/token')
  @Scope('sessions.update')
  @ResModel(Models.SESSION)
  @Throttle({
    limit: 10,
    key: 'ip:{ip},userId:{param-userId}',
  })
  @AuditEvent('session.update', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'createSession',
  })
  async createSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateSessionDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.createSession({
      user,
      input,
      request,
      response,
      locale,
      project,
      db,
    });
  }

  @Public()
  @Get('sessions/oauth2/:provider')
  @Scope('sessions.create')
  @Throttle({
    limit: 50,
    key: 'ip:{ip}',
  })
  @Sdk({
    name: 'createOAuth2Session',
  })
  async createOAuth2Session(
    @Query() input: CreateOAuth2SessionDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param() { provider }: ProviderParamDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.createOAuth2Session({
      input,
      request,
      response,
      provider,
      project,
    });
  }

  @Public()
  @Get('sessions/oauth2/callback/:provider/:projectId')
  @Scope('public')
  async OAuth2Callback(
    @Query() input: OAuth2CallbackDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param('projectId') projectId: string,
    @Param() { provider }: ProviderParamDTO,
  ) {
    const domain = request.host;
    const protocol = request.protocol;

    const params: Record<string, any> = { ...input };
    params['provider'] = provider;
    params['project'] = projectId;

    response
      .status(302)
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      .header('Pragma', 'no-cache')
      .redirect(
        `${protocol}://${domain}/v1/account/sessions/oauth2/${provider}/redirect?${new URLSearchParams(params).toString()}`,
      );
  }

  @Public()
  @Post('sessions/oauth2/callback/:provider/:projectId')
  @Scope('public')
  async OAuth2CallbackWithProject(
    @Body() input: OAuth2CallbackDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param('projectId') projectId: string,
    @Param() { provider }: ProviderParamDTO,
  ) {
    const domain = request.host;
    const protocol = request.protocol;

    const params: Record<string, any> = { ...input };
    params['provider'] = provider;
    params['project'] = projectId;

    response
      .status(302)
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      .header('Pragma', 'no-cache')
      .redirect(
        `${protocol}://${domain}/v1/account/sessions/oauth2/${provider}/redirect?${new URLSearchParams(params).toString()}`,
      );
  }

  @Public()
  @Get('sessions/oauth2/:provider/redirect')
  @Scope('public')
  @Throttle({
    limit: 50,
    key: 'ip:{ip}',
  })
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  async OAuth2Redirect(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Query() input: OAuth2CallbackDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Project() project: ProjectsDoc,
    @Param() { provider }: ProviderParamDTO,
  ) {
    return this.accountService.oAuth2Redirect({
      db: db,
      user,
      input,
      provider,
      request,
      response,
      project,
    });
  }

  @Public()
  @Get('tokens/oauth2/:provider')
  @Scope('sessions.create')
  @Throttle({
    limit: 50,
    key: 'ip:{ip}',
  })
  @Sdk({
    name: 'createOAuth2Token',
  })
  async createOAuth2Token(
    @Query() input: CreateOAuth2TokenDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param() { provider }: ProviderParamDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.createOAuth2Token({
      input,
      request,
      response,
      provider,
      project,
    });
  }

  @Public()
  @Post('tokens/magic-url')
  @ResModel(Models.TOKEN)
  @Throttle({
    limit: 60,
    key: ({ body, ip }) => [`email:${body['email']}`, `ip:${ip}`],
  })
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'createMagicURLToken',
  })
  async createMagicURLToken(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateMagicURLTokenDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.createMagicURLToken({
      db: db,
      user,
      input,
      request,
      response,
      locale,
      project,
    });
  }

  @Public()
  @Post('tokens/email')
  @Scope('sessions.create')
  @ResModel(Models.TOKEN)
  @Throttle({
    limit: 10,
    key: ({ body, ip }) => [`email:${body['email']}`, `ip:${ip}`],
  })
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'createEmailToken',
  })
  async createEmailToken(
    @Body() input: CreateEmailTokenDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Project() project: ProjectsDoc,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.createEmailToken({
      input,
      request,
      response,
      project,
      user,
      db: db,
      locale,
    });
  }

  @Public()
  @Put('sessions/magic-url')
  @ResModel(Models.SESSION)
  @Throttle({
    limit: 10,
    key: 'ip:{ip},userId:{param-userId}',
  })
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'updateMagicURLSession',
  })
  async updateMagicURLSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateSessionDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.createSession({
      user,
      input,
      request,
      response,
      locale,
      project,
      db,
    });
  }

  @Public()
  @Put('sessions/phone')
  @Throttle({
    limit: 10,
    key: 'ip:{ip},userId:{param-userId}',
  })
  @Scope('sessions.update')
  @ResModel(Models.SESSION)
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'updatePhoneSession',
  })
  async updatePhoneSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateSessionDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.createSession({
      user,
      input,
      request,
      response,
      locale,
      project,
      db,
    });
  }

  @Public()
  @Post(['tokens/phone', 'sessions/phone'])
  @Scope('sessions.create')
  @Throttle({
    limit: 10,
    key: ({ body, ip }) => [`phone:${body['phone']}`, `ip:${ip}`],
  })
  @ResModel(Models.TOKEN)
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'createPhoneToken',
  })
  async createPhoneToken(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreatePhoneTokenDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ) {
    return this.accountService.createPhoneToken({
      db: db,
      user,
      input,
      request,
      response,
      locale,
      project,
    });
  }

  @Post(['jwts', 'jwt'])
  @Scope('account')
  @ResModel(Models.JWT)
  @Throttle({
    limit: 100,
    key: 'userId:{userId}',
  })
  @Sdk({
    name: 'createJWT',
    auth: AuthType.JWT,
  })
  async createJWT(
    @User() user: UsersDoc,
    @Res({ passthrough: true }) response: NuvixRes,
  ) {
    return this.accountService.createJWT(user, response);
  }

  @Get('prefs')
  @Scope('account')
  @Label('res.status', 'OK')
  @Label('res.type', 'JSON')
  @ResModel(Models.PREFERENCES)
  getPrefs(@User() user: UsersDoc) {
    return user.get('prefs', {});
  }

  @Patch('prefs')
  @Scope('account')
  @Label('res.status', 'OK')
  @Label('res.type', 'JSON')
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
  @Label('res.status', 'OK')
  @Label('res.type', 'JSON')
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

  @Public()
  @Post('recovery')
  @Scope('sessions.update')
  @Throttle({
    limit: 10,
    key: ({ body, ip }) => [`email:${body['email']}`, `ip:${ip}`],
  })
  @AuditEvent('recovery.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  async createRecovery(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateRecoveryDTO,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
  ) {
    return this.accountService.createRecovery({
      db,
      user,
      input,
      locale,
      project,
      request,
      response,
    });
  }

  @Public()
  @Put('recovery')
  @Post('recovery')
  @Scope('sessions.update')
  @ResModel(Models.TOKEN)
  @Throttle({
    limit: 10,
    key: 'ip:{ip},userId:{param-userId}',
  })
  @AuditEvent('recovery.update', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  async updateRecovery(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: UpdateRecoveryDTO,
    @Project() project: ProjectsDoc,
    @Res({ passthrough: true }) response: NuvixRes,
  ) {
    // TODO: validate newPassword with password dictionry
    return this.accountService.updateRecovery({
      db,
      user,
      input,
      project,
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

  @Patch('mfa')
  @Scope('account')
  @AuditEvent('user.update', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  @ResModel(Models.ACCOUNT)
  @Sdk({
    name: 'updateMfa',
  })
  async updateMfa(
    @Body() { mfa }: UpdateAccountMfaDTO,
    @User() user: UsersDoc,
    @Session() session: SessionsDoc,
    @AuthDatabase() db: Database,
  ) {
    return this.accountService.updateMfa({
      mfa,
      session,
      user,
      db,
    });
  }

  @Get('mfa/factors')
  @Scope('account')
  @ResModel(Models.MFA_FACTORS)
  @Sdk({
    name: 'listMfaFactors',
  })
  async getMfaFactors(@User() user: UsersDoc) {
    return this.accountService.getMfaFactors(user);
  }

  @Post('mfa/authenticators/:type')
  @Scope('account')
  @AuditEvent('user.update', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  @ResModel(Models.MFA_TYPE)
  @Sdk({
    name: 'createMfaAuthenticator',
  })
  async createMfaAuthenticator(
    @Param() { type }: MfaAuthenticatorTypeParamDTO,
    @Project() project: ProjectsDoc,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
  ) {
    return this.accountService.createMfaAuthenticator({
      type,
      project,
      user,
      db,
    });
  }

  @Put('mfa/authenticators/:type')
  @Scope('account')
  @AuditEvent('user.update', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  @ResModel(Models.ACCOUNT)
  @Sdk({
    name: 'updateMfaAuthenticator',
  })
  async verifyMfaAuthenticator(
    @Param() { type }: MfaAuthenticatorTypeParamDTO,
    @Body() { otp }: VerifyMfaAuthenticatorDTO,
    @User() user: UsersDoc,
    @Session() session: SessionsDoc,
    @AuthDatabase() db: Database,
  ) {
    return this.accountService.verifyMfaAuthenticator({
      type,
      otp,
      user,
      session,
      db,
    });
  }

  @Post('mfa/recovery-codes')
  @Scope('account')
  @AuditEvent('user.update', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  @ResModel(Models.MFA_RECOVERY_CODES)
  @Sdk({
    name: 'createMfaRecoveryCodes',
  })
  async createMfaRecoveryCodes(
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
  ) {
    return this.accountService.createMfaRecoveryCodes({ user, db });
  }

  @Patch('mfa/recovery-codes')
  @Scope('account')
  @AuditEvent('user.update', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  @ResModel(Models.MFA_RECOVERY_CODES)
  @Sdk({
    name: 'updateMfaRecoveryCodes',
  })
  async updateMfaRecoveryCodes(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
  ) {
    return this.accountService.updateMfaRecoveryCodes({ db, user });
  }

  @Get('mfa/recovery-codes')
  @Scope('account')
  @ResModel(Models.MFA_RECOVERY_CODES)
  @Sdk({
    name: 'getMfaRecoveryCodes',
  })
  async getMfaRecoveryCodes(@User() user: UsersDoc) {
    const mfaRecoveryCodes = user.get('mfaRecoveryCodes', []);

    if (!mfaRecoveryCodes || mfaRecoveryCodes.length === 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND);
    }

    return {
      recoveryCodes: mfaRecoveryCodes,
    };
  }

  @Delete('mfa/authenticators/:type')
  @Scope('account')
  @AuditEvent('user.update', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResModel(Models.NONE)
  @Sdk({
    name: 'deleteMfaAuthenticator',
  })
  async deleteMfaAuthenticator(
    @Param() { type }: MfaAuthenticatorTypeParamDTO,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
  ) {
    return this.accountService.deleteMfaAuthenticator({
      type,
      user,
      db,
    });
  }

  @Post('mfa/challenge')
  @Scope('account')
  @Throttle({
    limit: 10,
    key: 'ip:{ip},userId:{userId}',
  })
  @ResModel(Models.MFA_CHALLENGE)
  @Sdk({
    name: 'createMfaChallenge',
  })
  async createMfaChallenge(
    @Body() input: CreateMfaChallengeDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Project() project: ProjectsDoc,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.createMfaChallenge({
      ...input,
      request,
      response,
      user,
      db,
      project,
      locale,
    });
  }

  @Put('mfa/challenge')
  @Scope('account')
  @ResModel(Models.SESSION)
  @Throttle({
    limit: 10,
    key: 'challengeId:{param-challengeId}',
  })
  @Sdk({
    name: 'updateMfaChallenge',
  })
  async updateMfaChallenge(
    @Body() input: VerifyMfaChallengeDTO,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Session() session: SessionsDoc,
  ) {
    return this.accountService.updateMfaChallenge({
      ...input,
      user,
      db,
      session,
    });
  }

  @Post('targets/push')
  @Scope('account')
  @AuditEvent('target.create', {
    resource: 'user/{user.$id}/target/{res.$id}',
    userId: '{user.$id}',
  })
  @ResModel(Models.TARGET)
  @Sdk({
    name: 'createPushTarget',
  })
  async createPushTarget(
    @Body() input: CreatePushTargetDTO,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Req() request: NuvixRequest,
  ) {
    return this.accountService.createPushTarget({
      ...input,
      user,
      db,
      request,
    });
  }

  @Put('targets/:targetId/push')
  @Scope('account')
  @AuditEvent('target.update', {
    resource: 'user/{user.$id}/target/{params.targetId}',
    userId: '{user.$id}',
  })
  @ResModel(Models.TARGET)
  @Sdk({
    name: 'updatePushTarget',
  })
  async updatePushTarget(
    @Param() { targetId }: TargetIdParamDTO,
    @Body() input: UpdatePushTargetDTO,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Req() request: NuvixRequest,
  ) {
    return this.accountService.updatePushTarget({
      targetId,
      ...input,
      user,
      db,
      request,
    });
  }

  @Delete('targets/:targetId/push')
  @Scope('account')
  @AuditEvent('target.delete', {
    resource: 'user/{user.$id}/target/{params.targetId}',
    userId: '{user.$id}',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResModel(Models.NONE)
  @Sdk({
    name: 'deletePushTarget',
  })
  async deletePushTarget(
    @Param() { targetId }: TargetIdParamDTO,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
  ) {
    return this.accountService.deletePushTarget({
      targetId,
      user,
      db,
    });
  }

  @Get('identities')
  @Scope('account')
  @ResModel(Models.IDENTITY, { list: true })
  @Sdk({
    name: 'getIdentities',
  })
  async getIdentities(
    @Query('queries', IdentitiesQueryPipe) queries: Queries[],
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
  ) {
    return this.accountService.getIdentities({ user, db, queries });
  }

  @Delete('identities/:identityId')
  @Scope('account')
  @AuditEvent('identity.delete', {
    resource: 'user/{user.$id}/identity/{params.identityId}',
    userId: '{user.$id}',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResModel(Models.NONE)
  @Sdk({
    name: 'deleteIdentity',
    code: HttpStatus.NO_CONTENT,
  })
  async deleteIdentity(
    @Param() { identityId }: IdentityIdParamDTO,
    @AuthDatabase() db: Database,
  ) {
    return this.accountService.deleteIdentity({
      identityId,
      db,
    });
  }
}
