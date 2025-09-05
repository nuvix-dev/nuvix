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
import { AccountService } from './account.service';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { Models } from '@nuvix/core/helper/response.helper';
import { User } from '@nuvix/core/decorators/user.decorator';
import {
  AuditEvent,
  Locale,
  ResModel,
  Scope,
  Throttle,
} from '@nuvix/core/decorators';
import { Query as Queries } from '@nuvix-tech/db';

import { AuthGuard, Public } from '@nuvix/core/resolvers/guards/auth.guard';
import { ParseQueryPipe } from '@nuvix/core/pipes/query.pipe';
import { ConsoleInterceptor } from '@nuvix/core/resolvers/interceptors/console.interceptor';
import { Exception } from '@nuvix/core/extend/exception';
import { LocaleTranslator } from '@nuvix/core/helper';

import {
  CreateAccountDTO,
  UpdateEmailDTO,
  UpdateNameDTO,
  UpdatePasswordDTO,
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
} from './DTO/token.dto';
import {
  CreateEmailVerificationDTO,
  UpdateEmailVerificationDTO,
} from './DTO/verification.dto';
import type { SessionsDoc, UsersDoc } from '@nuvix/utils/types';
import { IdentitiesQueryPipe } from '@nuvix/core/pipes/queries';

@Controller({ version: ['1'], path: 'account' })
@UseGuards(AuthGuard)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Public()
  @Post()
  @Scope('sessions.create')
  @ResModel(Models.USER)
  @AuditEvent('user.create', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  async createAccount(
    @Body() input: CreateAccountDTO,
    @User() user: UsersDoc,
    @Req() request: NuvixRequest,
  ) {
    return this.accountService.createAccount(
      input.userId,
      input.email,
      input.password,
      input.name,
      request,
      user,
    );
  }

  @Get()
  @Scope('account')
  @ResModel(Models.USER)
  async getAccount(@User() user: UsersDoc) {
    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }
    return user;
  }

  @Delete()
  @Scope('account')
  @ResModel(Models.NONE)
  @AuditEvent('user.delete', 'user/{res.$id}')
  async deleteAccount(@User() user: UsersDoc) {
    return this.accountService.deleteAccount(user);
  }

  @Get('sessions')
  @Scope('account')
  @ResModel(Models.SESSION, { list: true })
  async getSessions(
    @User() user: UsersDoc,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.getSessions(user, locale);
  }

  @Delete('sessions')
  @Scope('account')
  @ResModel(Models.NONE)
  @AuditEvent('session.delete', 'user/{user.$id}')
  async deleteSessions(
    @User() user: UsersDoc,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.deleteSessions(user, locale, request, response);
  }

  @Get('sessions/:id')
  @Scope('account')
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
  @ResModel(Models.NONE)
  @AuditEvent('session.delete', 'user/{user.$id}')
  async deleteSession(
    @User() user: UsersDoc,
    @Param('id') id: string,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Session() session: SessionsDoc,
  ) {
    if (id === 'current') {
      id = session.getId();
    }
    return this.accountService.deleteSession(user, id, request, response);
  }

  @Patch('sessions/:id')
  @Scope('account')
  @ResModel(Models.SESSION)
  @AuditEvent('session.update', 'user/{res.userId}')
  async updateSession(@User() user: UsersDoc, @Param('id') id: string) {
    return this.accountService.updateSession(user, id);
  }

  @Public()
  @Post(['sessions/email', 'sessions'])
  @Scope('sessions.create')
  @ResModel(Models.SESSION)
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  async createEmailSession(
    @User() user: UsersDoc,
    @Body() input: CreateEmailSessionDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.createEmailSession(
      user,
      input,
      locale,
      request,
      response,
    );
  }

  @Public()
  @Post('sessions/token')
  @Scope('sessions.update')
  @ResModel(Models.SESSION)
  @AuditEvent('session.update', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  async createSession(
    @User() user: UsersDoc,
    @Body() input: CreateSessionDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.createSession({
      user,
      input,
      request,
      response,
      locale,
    });
  }

  @Public()
  @Get('sessions/oauth2/:provider')
  @Scope('sessions.create')
  async createOAuth2Session(
    @Query() input: CreateOAuth2SessionDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param() { provider }: ProviderParamDTO,
  ) {
    return this.accountService.createOAuth2Session({
      input,
      request,
      response,
      provider,
    });
  }

  @Public()
  @Get('sessions/oauth2/callback/:provider/:projectId')
  @Post('sessions/oauth2/callback/:provider/:projectId')
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

    const params: Record<string, any> = { ...input };
    params['provider'] = provider;
    params['project'] = projectId;

    response
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      .header('Pragma', 'no-cache')
      .redirect(
        `${protocol}://${domain}/account/sessions/oauth2/${provider}/redirect?${new URLSearchParams(params).toString()}`,
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
    @User() user: UsersDoc,
    @Query() input: OAuth2CallbackDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param() { provider }: ProviderParamDTO,
  ) {
    return this.accountService.oAuth2Redirect({
      user,
      input,
      provider,
      request,
      response,
    });
  }

  @Public()
  @Get('tokens/oauth2/:provider')
  @Scope('sessions.create')
  async createOAuth2Token(
    @Query() input: CreateOAuth2TokenDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param() { provider }: ProviderParamDTO,
  ) {
    return this.accountService.createOAuth2Token({
      input,
      request,
      response,
      provider,
    });
  }

  @Public()
  @Post('tokens/magic-url')
  @ResModel(Models.TOKEN)
  @AuditEvent('session.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  async createMagicURLToken(
    @User() user: UsersDoc,
    @Body() input: CreateMagicURLTokenDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.createMagicURLToken({
      user,
      input,
      request,
      response,
      locale,
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
  async createEmailToken(
    @Body() input: CreateEmailTokenDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @User() user: UsersDoc,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.createEmailToken({
      input,
      request,
      response,
      user,
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
  async updateMagicURLSession(
    @User() user: UsersDoc,
    @Body() input: CreateSessionDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.createSession({
      input,
      request,
      response,
      user,
      locale,
    });
  }

  @Post(['jwts', 'jwt'])
  @Scope('account')
  @ResModel(Models.JWT)
  async createJWT(
    @User() user: UsersDoc,
    @Res({ passthrough: true }) response: NuvixRes,
  ) {
    return this.accountService.createJWT(user, response);
  }

  @Get('prefs')
  @Scope('account')
  @ResModel(Models.PREFERENCES)
  getPrefs(@User() user: UsersDoc) {
    return user.get('prefs', {});
  }

  @Patch('prefs')
  @Scope('account')
  @ResModel(Models.PREFERENCES)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updatePrefs(@User() user: UsersDoc, @Body() input: UpdatePrefsDTO) {
    return this.accountService.updatePrefs(user, input.prefs);
  }

  @Patch('name')
  @Scope('account')
  @ResModel(Models.USER)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updateName(@User() user: UsersDoc, @Body() { name }: UpdateNameDTO) {
    return this.accountService.updateName(user, name);
  }

  @Patch('password')
  @Scope('account')
  @ResModel(Models.USER)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updatePassword(
    @User() user: UsersDoc,
    @Body() input: UpdatePasswordDTO,
  ) {
    return this.accountService.updatePassword(user, input);
  }

  @Patch('email')
  @Scope('account')
  @ResModel(Models.USER)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updateEmail(
    @User() user: UsersDoc,
    @Body() updateEmailDTO: UpdateEmailDTO,
  ) {
    return this.accountService.updateEmail(user, updateEmailDTO);
  }

  @Patch('status')
  @Scope('account')
  @ResModel(Models.USER)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updateStatus(
    @User() user: UsersDoc,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
  ) {
    return this.accountService.updateStatus({
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
    @User() user: UsersDoc,
    @Body() input: CreateRecoveryDTO,
    @Locale() locale: LocaleTranslator,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
  ) {
    return this.accountService.createRecovery({
      user,
      input,
      locale,
      request,
      response,
    });
  }

  @Public()
  @Put('recovery')
  @Post('recovery')
  @Scope('sessions.update')
  @AuditEvent('recovery.update', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  async updateRecovery(
    @User() user: UsersDoc,
    @Body() input: UpdateRecoveryDTO,
    @Res() response: NuvixRes,
  ) {
    return this.accountService.updateRecovery({
      user,
      input,
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
  async createEmailVerification(
    @Body() { url }: CreateEmailVerificationDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @User() user: UsersDoc,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.createEmailVerification({
      url,
      request,
      response,
      user,
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
  async updateEmailVerification(
    @Body() { userId, secret }: UpdateEmailVerificationDTO,
    @Res({ passthrough: true }) response: NuvixRes,
    @User() user: UsersDoc,
  ) {
    return this.accountService.updateEmailVerification({
      userId,
      secret,
      response,
      user,
    });
  }

  @Get('logs')
  @ResModel({ type: Models.LOG, list: true })
  async getLogs(@User() user: UsersDoc, @Query('queries') queries: Queries[]) {
    return this.accountService.getLogs(user, queries);
  }

  @Patch('mfa')
  @Scope('account')
  @AuditEvent('user.update', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  @ResModel(Models.ACCOUNT)
  async updateMfa(
    @Body() { mfa }: UpdateAccountMfaDTO,
    @User() user: UsersDoc,
    @Session() session: SessionsDoc,
  ) {
    return this.accountService.updateMfa({
      mfa,
      session,
      user,
    });
  }

  @Get('mfa/factors')
  @Scope('account')
  @ResModel(Models.MFA_FACTORS)
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
  async createMfaAuthenticator(
    @Param() { type }: MfaAuthenticatorTypeParamDTO,
    @User() user: UsersDoc,
  ) {
    return this.accountService.createMfaAuthenticator({
      type,

      user,
    });
  }

  @Put('mfa/authenticators/:type')
  @Scope('account')
  @AuditEvent('user.update', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  @ResModel(Models.USER)
  async verifyMfaAuthenticator(
    @Param() { type }: MfaAuthenticatorTypeParamDTO,
    @Body() { otp }: VerifyMfaAuthenticatorDTO,
    @User() user: UsersDoc,
    @Session() session: SessionsDoc,
  ) {
    return this.accountService.verifyMfaAuthenticator({
      type,
      otp,
      user,
      session,
    });
  }

  @Post('mfa/recovery-codes')
  @Scope('account')
  @AuditEvent('user.update', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  @ResModel(Models.MFA_RECOVERY_CODES)
  async createMfaRecoveryCodes(@User() user: UsersDoc) {
    return this.accountService.createMfaRecoveryCodes({ user });
  }

  @Patch('mfa/recovery-codes')
  @Scope('account')
  @AuditEvent('user.update', {
    resource: 'user/{res.$id}',
    userId: '{res.$id}',
  })
  @ResModel(Models.MFA_RECOVERY_CODES)
  async updateMfaRecoveryCodes(@User() user: UsersDoc) {
    return this.accountService.updateMfaRecoveryCodes({ user });
  }

  @Get('mfa/recovery-codes')
  @Scope('account')
  @ResModel(Models.MFA_RECOVERY_CODES)
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
  async deleteMfaAuthenticator(
    @Param() { type }: MfaAuthenticatorTypeParamDTO,
    @User() user: UsersDoc,
  ) {
    return this.accountService.deleteMfaAuthenticator({
      type,
      user,
    });
  }

  @Post('mfa/challenge')
  @Scope('account')
  @ResModel(Models.MFA_CHALLENGE)
  async createMfaChallenge(
    @Body() input: CreateMfaChallengeDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @User() user: UsersDoc,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.createMfaChallenge({
      ...input,
      request,
      response,
      user,

      locale,
    });
  }

  @Put('mfa/challenge')
  @Scope('account')
  @ResModel(Models.SESSION)
  async updateMfaChallenge(
    @Body() input: VerifyMfaChallengeDTO,
    @User() user: UsersDoc,
    @Session() session: SessionsDoc,
  ) {
    return this.accountService.updateMfaChallenge({
      ...input,
      user,
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
  async createPushTarget(
    @Body() input: CreatePushTargetDTO,
    @User() user: UsersDoc,
    @Req() request: NuvixRequest,
  ) {
    return this.accountService.createPushTarget({
      ...input,
      user,
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
  async updatePushTarget(
    @Param() { targetId }: TargetIdParamDTO,
    @Body() input: UpdatePushTargetDTO,
    @User() user: UsersDoc,
    @Req() request: NuvixRequest,
  ) {
    return this.accountService.updatePushTarget({
      targetId,
      ...input,
      user,
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
  async deletePushTarget(
    @Param() { targetId }: TargetIdParamDTO,
    @User() user: UsersDoc,
  ) {
    return this.accountService.deletePushTarget({
      targetId,
      user,
    });
  }

  @Get('identities')
  @Scope('account')
  @ResModel(Models.IDENTITY, { list: true })
  async getIdentities(
    @Query('queries', IdentitiesQueryPipe) queries: Queries[],
    @User() user: UsersDoc,
  ) {
    return this.accountService.getIdentities({ user, queries });
  }

  @Delete('identities/:identityId')
  @Scope('account')
  @AuditEvent('identity.delete', {
    resource: 'user/{user.$id}/identity/{params.identityId}',
    userId: '{user.$id}',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResModel(Models.NONE)
  async deleteIdentity(@Param() { identityId }: IdentityIdParamDTO) {
    return this.accountService.deleteIdentity({
      identityId,
    });
  }
}
