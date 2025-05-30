import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuditEvent, Label, Scope, Sdk } from '@nuvix/core/decorators';
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
import { Database, Document } from '@nuvix/database';
import {
  CreateAccountDTO,
  UpdateEmailDTO,
  UpdatePrefsDTO,
} from './DTO/account.dto';
import {
  CreateEmailSessionDTO,
  CreateOAuth2SessionDTO,
  CreateSessionDTO,
  OAuth2CallbackDTO,
} from './DTO/session.dto';
import { AccountService } from './account.service';

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
  @AuditEvent('user.create', { resource: 'user/{res.$id}', userId: 'res.$id' })
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
    userId: 'res.userId',
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
    userId: 'res.userId',
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
    userId: 'res.userId',
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
    @Project() project: Document,
  ) {
    return await this.accountService.createOAuth2Session({
      input,
      request,
      response,
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
    @Param('provider') provider: string,
    @Param('projectId') projectId: string,
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
    @Param('provider') provider: string,
    @Param('projectId') projectId: string,
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
  @ResModel(Models.SESSION)
  @AuditEvent('session.update', {
    resource: 'user/{res.userId}',
    userId: 'res.userId',
  })
  async OAuth2Redirect(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Query() input: OAuth2CallbackDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Project() project: Document,
    @Param('provider') provider: string,
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
}
