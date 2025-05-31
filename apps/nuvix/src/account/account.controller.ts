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

import { Database, Document } from '@nuvix/database';
import { Query as Queries } from '@nuvix/database';

import {
  AuditEvent,
  AuthType,
  Label,
  Scope,
  Sdk,
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
import { ParseQueryPipe } from '@nuvix/core/pipes';

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
  @ResModel(Models.USER)
  @AuditEvent('user.create', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  async createAccount(
    @AuthDatabase() authDatabase: Database,
    @Body() input: CreateAccountDTO,
    @User() user: Document,
    @Project() project: Document,
  ) {
    return await this.accountService.createAccount(
      authDatabase,
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
  @ResModel(Models.USER)
  async getAccount(@User() user: Document) {
    if (user.isEmpty()) {
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
  async deleteAccount(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
  ) {
    return await this.accountService.deleteAccount(authDatabase, user);
  }

  @Get('sessions')
  @Scope('account')
  @Label('res.status', 'OK')
  @Label('res.type', 'JSON')
  @ResModel(Models.SESSION, { list: true })
  async getSessions(
    @User() user: Document,
    @Locale() locale: LocaleTranslator,
  ) {
    return await this.accountService.getSessions(user, locale);
  }

  @Delete('sessions')
  @Scope('account')
  @Label('res.status', 'NO_CONTENT')
  @Label('res.type', 'JSON')
  @ResModel(Models.NONE)
  @AuditEvent('session.delete', 'user/{user.$id}')
  async deleteSessions(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
    @Locale() locale: LocaleTranslator,
  ) {
    return await this.accountService.deleteSessions(
      authDatabase,
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
    @User() user: Document,
    @Param('id') sessionId: string,
    @Locale() locale: LocaleTranslator,
  ) {
    return await this.accountService.getSession(user, sessionId, locale);
  }

  @Delete('sessions/:id')
  @Scope('account')
  @Label('res.status', 'NO_CONTENT')
  @Label('res.type', 'JSON')
  @ResModel(Models.NONE)
  @AuditEvent('session.delete', 'user/{user.$id}')
  async deleteSession(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Param('id') id: string,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
    @Locale() locale: LocaleTranslator,
  ) {
    return await this.accountService.deleteSession(
      authDatabase,
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
  @AuditEvent('session.update', 'user/{res.userId}')
  async updateSession(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Param('id') id: string,
    @Project() project: Document,
  ) {
    return await this.accountService.updateSession(
      authDatabase,
      user,
      id,
      project,
    );
  }

  @Public()
  @Post(['sessions/email', 'sessions'])
  @Scope('sessions.create')
  @Label('res.status', 'CREATED')
  @Label('res.type', 'JSON')
  @ResModel(Models.SESSION)
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  async createEmailSession(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Body() input: CreateEmailSessionDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: Document,
  ) {
    return await this.accountService.createEmailSession(
      authDatabase,
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
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'createAnonymousSession',
  })
  async createAnonymousSession(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: Document,
  ) {
    return await this.accountService.createAnonymousSession({
      user,
      request,
      response,
      locale,
      project,
      db: authDatabase,
    });
  }

  @Public()
  @Post('sessions/token')
  @Scope('sessions.update')
  @ResModel(Models.SESSION)
  @AuditEvent('session.update', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'createSession',
  })
  async createSession(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Body() input: CreateSessionDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: Document,
  ) {
    return await this.accountService.createSession({
      user,
      input,
      request,
      response,
      locale,
      project,
      authDatabase,
    });
  }

  @Public()
  @Get('sessions/oauth2/:provider')
  @Scope('sessions.create')
  @Sdk({
    name: 'createOAuth2Session',
  })
  async createOAuth2Session(
    @Query() input: CreateOAuth2SessionDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param() { provider }: ProviderParamDTO,
    @Project() project: Document,
  ) {
    return await this.accountService.createOAuth2Session({
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
    const domain = request.hostname;
    const protocol = request.protocol;

    const params = { ...input };
    params['provider'] = provider;
    params['project'] = projectId;

    response
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
    const domain = request.hostname;
    const protocol = request.protocol;

    const params = { ...input };
    params['provider'] = provider;
    params['project'] = projectId;

    response
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      .header('Pragma', 'no-cache')
      .redirect(
        `${protocol}://${domain}/v1/account/sessions/oauth2/${provider}/redirect?${new URLSearchParams(params).toString()}`,
      );
  }

  @Public()
  @Get('sessions/oauth2/:provider/redirect')
  @Scope('public')
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  async OAuth2Redirect(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Query() input: OAuth2CallbackDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Project() project: Document,
    @Param() { provider }: ProviderParamDTO,
  ) {
    return this.accountService.oAuth2Redirect({
      db: authDatabase,
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
  @Sdk({
    name: 'createOAuth2Token',
  })
  async createOAuth2Token(
    @Query() input: CreateOAuth2TokenDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param() { provider }: ProviderParamDTO,
    @Project() project: Document,
  ) {
    return await this.accountService.createOAuth2Token({
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
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'createMagicURLToken',
  })
  async createMagicURLToken(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Body() input: CreateMagicURLTokenDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: Document,
  ) {
    return await this.accountService.createMagicURLToken({
      db: authDatabase,
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
    @Res() response: NuvixRes,
    @Project() project: Document,
    @User() user: Document,
    @AuthDatabase() authDatabase: Database,
    @Locale() locale: LocaleTranslator,
  ) {
    return await this.accountService.createEmailToken({
      input,
      request,
      response,
      project,
      user,
      db: authDatabase,
      locale,
    });
  }

  @Public()
  @Put('sessions/magic-url')
  @ResModel(Models.SESSION)
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'updateMagicURLSession',
  })
  async updateMagicURLSession(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Body() input: CreateSessionDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: Document,
  ) {
    return await this.accountService.createSession({
      user,
      input,
      request,
      response,
      locale,
      project,
      authDatabase,
    });
  }

  @Public()
  @Put('sessions/phone')
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
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Body() input: CreateSessionDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: Document,
  ) {
    return await this.accountService.createSession({
      user,
      input,
      request,
      response,
      locale,
      project,
      authDatabase,
    });
  }

  @Public()
  @Post(['tokens/phone', 'sessions/phone'])
  @Scope('sessions.create')
  @ResModel(Models.TOKEN)
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'createPhoneToken',
  })
  async createPhoneToken(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Body() input: CreatePhoneTokenDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: Document,
  ) {
    return await this.accountService.createPhoneToken({
      db: authDatabase,
      user,
      input,
      request,
      response,
      locale,
      project,
    });
  }

  @Post(['jwts', 'jwt'])
  @AuthType('JWT')
  @Scope('account')
  @ResModel(Models.JWT)
  @Sdk({
    name: 'createJWT',
  })
  async createJWT(
    @User() user: Document,
    @Res({ passthrough: true }) response: NuvixRes,
  ) {
    return await this.accountService.createJWT(user, response);
  }

  @Get('prefs')
  @Scope('account')
  @Label('res.status', 'OK')
  @Label('res.type', 'JSON')
  @ResModel(Models.PREFERENCES)
  getPrefs(@User() user: Document) {
    return user.getAttribute('prefs', {});
  }

  @Patch('prefs')
  @Scope('account')
  @Label('res.status', 'OK')
  @Label('res.type', 'JSON')
  @ResModel(Models.PREFERENCES)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updatePrefs(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Body() input: UpdatePrefsDTO,
  ) {
    return await this.accountService.updatePrefs(
      authDatabase,
      user,
      input.prefs,
    );
  }

  @Patch('name')
  @Scope('account')
  @ResModel(Models.USER)
  @AuditEvent('user.update', 'user/{res.$id}')
  @Sdk({
    name: 'updateName',
  })
  async updateName(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Body() { name }: UpdateNameDTO,
  ) {
    return await this.accountService.updateName(authDatabase, name, user);
  }

  @Patch('password')
  @Scope('account')
  @ResModel(Models.USER)
  @AuditEvent('user.update', 'user/{res.$id}')
  @Sdk({
    name: 'updatePassword',
  })
  async updatePassword(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Body() { password, oldPassword }: UpdatePasswordDTO,
    @Project() project: Document,
  ) {
    return await this.accountService.updatePassword({
      db: authDatabase,
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
  @ResModel(Models.USER)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updateEmail(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Body() updateEmailDto: UpdateEmailDTO,
  ) {
    return await this.accountService.updateEmail(
      authDatabase,
      user,
      updateEmailDto,
    );
  }

  @Patch('phone')
  @Scope('account')
  @ResModel(Models.USER)
  @AuditEvent('user.update', 'user/{res.$id}')
  @Sdk({
    name: 'updatePhone',
  })
  async updatePhone(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Body() { password, phone }: UpdatePhoneDTO,
    @Project() project: Document,
  ) {
    return await this.accountService.updatePhone({
      db: authDatabase,
      password,
      phone,
      user,
      project,
    });
  }

  @Patch('status')
  @Scope('account')
  @ResModel(Models.USER)
  @AuditEvent('user.update', 'user/{res.$id}')
  @Sdk({
    name: 'updateStatus',
  })
  async updateStatus(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
  ) {
    return await this.accountService.updateStatus({
      db: authDatabase,
      user,
      request,
      response,
    });
  }

  @Public()
  @Post('recovery')
  @Scope('sessions.update')
  @AuditEvent('recovery.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  async createRecovery(
    @AuthDatabase() db: Database,
    @User() user: Document,
    @Body() input: CreateRecoveryDTO,
    @Locale() locale: LocaleTranslator,
    @Project() project: Document,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
  ) {
    return await this.accountService.createRecovery({
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
  @Post('recovery') // Note: PHP has this as App::put, but also a Post. Assuming both are meant or Put is primary.
  @Scope('sessions.update')
  @AuditEvent('recovery.update', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  async updateRecovery(
    @AuthDatabase() db: Database,
    @User() user: Document,
    @Body() input: UpdateRecoveryDTO,
    @Project() project: Document,
    @Res() response: NuvixRes,
  ) {
    // TODO: validate newPassword with password dictionry
    return await this.accountService.updateRecovery({
      db,
      user,
      input,
      project,
      response,
    });
  }

  @Post('verification')
  @Scope('account')
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
    @Project() project: Document,
    @User() user: Document,
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
    @User() user: Document,
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
    @User() user: Document,
    @AuthDatabase() db: Database,
    @Project() project: Document,
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
    @User() user: Document,
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
    @User() user: Document,
    @Session() session: Document,
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
  async getMfaFactors(@User() user: Document) {
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
    @Project() project: Document,
    @User() user: Document,
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
  @ResModel(Models.USER)
  @Sdk({
    name: 'updateMfaAuthenticator',
  })
  async verifyMfaAuthenticator(
    @Param() { type }: MfaAuthenticatorTypeParamDTO,
    @Body() { otp }: VerifyMfaAuthenticatorDTO,
    @User() user: Document,
    @Session() session: Document,
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
    @User() user: Document,
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
    @User() user: Document,
  ) {
    return this.accountService.updateMfaRecoveryCodes({ db, user });
  }

  @Get('mfa/recovery-codes')
  @Scope('account')
  @ResModel(Models.MFA_RECOVERY_CODES)
  @Sdk({
    name: 'getMfaRecoveryCodes',
  })
  async getMfaRecoveryCodes(@User() user: Document) {
    const mfaRecoveryCodes = user.getAttribute('mfaRecoveryCodes', []);

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
    @User() user: Document,
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
  @ResModel(Models.MFA_CHALLENGE)
  @Sdk({
    name: 'createMfaChallenge',
  })
  async createMfaChallenge(
    @Body() input: CreateMfaChallengeDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @User() user: Document,
    @AuthDatabase() db: Database,
    @Project() project: Document,
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
  @Sdk({
    name: 'updateMfaChallenge',
  })
  async updateMfaChallenge(
    @Body() input: VerifyMfaChallengeDTO,
    @User() user: Document,
    @AuthDatabase() db: Database,
    @Session() session: Document,
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
    @User() user: Document,
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
    @User() user: Document,
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
    @User() user: Document,
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
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @User() user: Document,
    @AuthDatabase() db: Database,
  ) {
    return this.accountService.getIdentities({ user, db, queries });
  }

  @Delete('identities/:identityId')
  @Scope('account')
  @AuditEvent('user.update', {
    resource: 'user/{user.$id}/identity/{params.identityId}',
    userId: '{user.$id}',
  }) // TODO: #AI Revisit AuditEvent type, 'identity.delete' was not recognized. 'user.update' used as placeholder.
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResModel(Models.NONE)
  @Sdk({
    name: 'deleteIdentity',
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
