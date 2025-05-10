import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { Database, Document } from '@nuvix/database';
import {
  CreateAccountDTO,
  UpdateEmailDTO,
  UpdatePrefsDTO,
} from './DTO/account.dto';
import { Models } from '@nuvix/core/helper/response.helper';
import { Public } from '@nuvix/core/resolvers/guards/auth.guard';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import {
  AuthDatabase,
  Project,
} from '@nuvix/core/decorators/project.decorator';
import { User } from '@nuvix/core/decorators/project-user.decorator';
import { CreateEmailSessionDTO } from './DTO/session.dto';
import { Locale } from '@nuvix/core/decorators/locale.decorator';
import { LocaleTranslator } from '@nuvix/core/helper/locale.helper';
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor';
import { ResModel } from '@nuvix/core/decorators/res-model.decorator';
import { ProjectGuard } from '@nuvix/core/resolvers/guards';
import { AuditEvent, Label, Scope } from '@nuvix/core/decorators';

@Controller({ version: ['1'], path: 'account' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService) { }

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
  @ResModel(Models.USER)
  async getAccount(@User() user: Document) {
    return user;
  }

  @Get('prefs')
  @ResModel(Models.PREFERENCES)
  getPrefs(@User() user: Document) {
    return user.getAttribute('prefs', {});
  }

  @Patch('prefs')
  @ResModel(Models.PREFERENCES)
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
  @ResModel(Models.USER)
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

  @Public()
  @Post(['sessions/email', 'sessions'])
  @ResModel(Models.SESSION)
  async createEmailSession(
    @AuthDatabase() authDatabase: Database,
    @User() user: Document,
    @Body() input: CreateEmailSessionDTO,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
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

  @Get('sessions')
  @ResModel({ type: Models.SESSION, list: true })
  async getSessions(
    @User() user: Document,
    @Locale() locale: LocaleTranslator,
  ) {
    return await this.accountService.getSessions(user, locale);
  }

  @Delete('sessions')
  @ResModel(Models.NONE)
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
  @ResModel(Models.SESSION)
  async getSession(
    @User() user: Document,
    @Param('id') sessionId: string,
    @Locale() locale: LocaleTranslator,
  ) {
    return await this.accountService.getSession(user, sessionId, locale);
  }

  @Delete('sessions/:id')
  @ResModel(Models.NONE)
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
  @ResModel(Models.SESSION)
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
}
