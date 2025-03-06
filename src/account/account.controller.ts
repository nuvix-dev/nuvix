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
import { ProjectGuard } from 'src/core/resolvers/guards/project.guard';
import { Document } from '@nuvix/database';
import {
  CreateAccountDTO,
  UpdateEmailDTO,
  UpdatePrefsDTO,
} from 'src/account/DTO/account.dto';
import { Models } from 'src/core/helper/response.helper';
import { Public } from 'src/core/resolvers/guards/auth.guard';
import { ResponseInterceptor } from 'src/core/resolvers/interceptors/response.interceptor';
import { Project } from 'src/core/decorators/project.decorator';
import { User } from 'src/core/decorators/project-user.decorator';
import { CreateEmailSessionDTO } from './DTO/session.dto';
import { Locale } from 'src/core/decorators/locale.decorator';
import { LocaleTranslator } from 'src/core/helper/locale.helper';
import { ApiInterceptor } from 'src/core/resolvers/interceptors/api.interceptor';
import { ResModel } from 'src/core/decorators';

@Controller({ version: ['1'], path: 'account' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Public()
  @Post()
  @ResModel(Models.USER)
  async createAccount(
    @Body() input: CreateAccountDTO,
    @User() user: Document,
    @Project() project: Document,
  ) {
    return await this.accountService.createAccount(
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
  async updatePrefs(@User() user: Document, @Body() input: UpdatePrefsDTO) {
    return await this.accountService.updatePrefs(user, input.prefs);
  }

  @Patch('email')
  @ResModel(Models.USER)
  async updateEmail(
    @User() user: Document,
    @Body() updateEmailDto: UpdateEmailDTO,
  ) {
    return await this.accountService.updateEmail(user, updateEmailDto);
  }

  @Public()
  @Post(['sessions/email', 'sessions'])
  @ResModel(Models.SESSION)
  async createEmailSession(
    @User() user: Document,
    @Body() input: CreateEmailSessionDTO,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
    @Locale() locale: LocaleTranslator,
    @Project() project: Document,
  ) {
    return await this.accountService.createEmailSession(
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
    @User() user: Document,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
    @Locale() locale: LocaleTranslator,
  ) {
    return await this.accountService.deleteSessions(
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
    @User() user: Document,
    @Param('id') id: string,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
    @Locale() locale: LocaleTranslator,
  ) {
    return await this.accountService.deleteSession(
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
    @User() user: Document,
    @Param('id') id: string,
    @Project() project: Document,
  ) {
    return await this.accountService.updateSession(user, id, project);
  }
}
