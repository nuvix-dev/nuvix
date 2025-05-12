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
import { AuditEvent, Label, Scope } from '@nuvix/core/decorators';
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
import { CreateEmailSessionDTO } from './DTO/session.dto';
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
