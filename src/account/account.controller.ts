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
import { ProjectGuard } from 'src/core/resolver/guards/project.guard';
import { Document } from '@nuvix/database';
import {
  CreateAccountDTO,
  UpdateEmailDTO,
  UpdatePrefsDTO,
} from 'src/account/DTO/account.dto';
import { Response } from 'src/core/helper/response.helper';
import { Public } from 'src/core/resolver/guards/auth.guard';
import {
  ResolverInterceptor,
  ResponseType,
} from 'src/core/resolver/response.resolver';
import { Project } from 'src/core/resolver/project.resolver';
import { User } from 'src/core/resolver/project-user.resolver';
import { CreateEmailSessionDTO } from './DTO/session.dto';
import { Locale } from 'src/core/resolver/locale.resolver';
import { LocaleTranslator } from 'src/core/helper/locale.helper';
import { ApiInterceptor } from 'src/core/resolver/api.resolver';

@Controller({ version: ['1'], path: 'account' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResolverInterceptor, ApiInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Public()
  @Post()
  @ResponseType(Response.MODEL_USER)
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
  @ResponseType(Response.MODEL_USER)
  async getAccount(@User() user: Document) {
    return user;
  }

  @Get('prefs')
  @ResponseType(Response.MODEL_PREFERENCES)
  getPrefs(@User() user: Document) {
    return user.getAttribute('prefs', {});
  }

  @Patch('prefs')
  @ResponseType(Response.MODEL_PREFERENCES)
  async updatePrefs(@User() user: Document, @Body() input: UpdatePrefsDTO) {
    return await this.accountService.updatePrefs(user, input.prefs);
  }

  @Patch('email')
  @ResponseType(Response.MODEL_USER)
  async updateEmail(
    @User() user: Document,
    @Body() updateEmailDto: UpdateEmailDTO,
  ) {
    return await this.accountService.updateEmail(user, updateEmailDto);
  }

  @Public()
  @Post(['sessions/email', 'sessions'])
  @ResponseType(Response.MODEL_SESSION)
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
  @ResponseType({ type: Response.MODEL_SESSION, list: true })
  async getSessions(
    @User() user: Document,
    @Locale() locale: LocaleTranslator,
  ) {
    return await this.accountService.getSessions(user, locale);
  }

  @Delete('sessions')
  @ResponseType(Response.MODEL_NONE)
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
  @ResponseType(Response.MODEL_SESSION)
  async getSession(
    @User() user: Document,
    @Param('id') sessionId: string,
    @Locale() locale: LocaleTranslator,
  ) {
    return await this.accountService.getSession(user, sessionId, locale);
  }

  @Delete('sessions/:id')
  @ResponseType(Response.MODEL_NONE)
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
  @ResponseType(Response.MODEL_SESSION)
  async updateSession(
    @User() user: Document,
    @Param('id') id: string,
    @Project() project: Document,
  ) {
    return await this.accountService.updateSession(user, id, project);
  }
}
