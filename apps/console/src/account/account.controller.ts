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
  Request,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { Models } from '@nuvix/core/helper/response.helper';
import { User } from '@nuvix/core/decorators/user.decorator';
import { ResModel } from '@nuvix/core/decorators';
import { Document, Query as Queries } from '@nuvix/database';

import {
  CreateAccountDTO,
  UpdateEmailDTO,
  UpdateNameDTO,
  UpdatePasswordDTO,
  UpdatePhoneDTO,
  UpdatePrefsDTO,
} from './DTO/account.dto';
import { CreateEmailSessionDTO } from './DTO/session.dto';
import { AuthGuard, Public } from '@nuvix/core/resolvers/guards/auth.guard';
import { ParseQueryPipe } from '@nuvix/core/pipes/query.pipe';
import { ConsoleInterceptor } from '@nuvix/core/resolvers/interceptors/console.interceptor';

@Controller({ version: ['1'], path: 'console/account' })
@UseGuards(AuthGuard)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Public()
  @Post()
  @ResModel({ type: Models.USER })
  async createAccount(
    @Body() input: CreateAccountDTO,
    @User() user: Document,
    @Request() req: any,
  ) {
    return await this.accountService.createAccount(
      input.userId,
      input.email,
      input.password,
      input.name,
      req,
      user,
    );
  }

  @Get()
  @ResModel({ type: Models.USER })
  async getAccount(@User() user: Document) {
    return user;
  }

  @Get('prefs')
  @ResModel({ type: Models.PREFERENCES })
  getPrefs(@User() user: Document) {
    return user.getAttribute('prefs', {});
  }

  @Patch('prefs')
  @ResModel({ type: Models.PREFERENCES })
  async updatePrefs(@User() user: Document, @Body() input: UpdatePrefsDTO) {
    return await this.accountService.updatePrefs(user, input.prefs);
  }

  @Patch('email')
  @ResModel({ type: Models.USER })
  async updateEmail(
    @User() user: Document,
    @Body() updateEmailDto: UpdateEmailDTO,
  ) {
    return await this.accountService.updateEmail(user, updateEmailDto);
  }

  @Patch('name')
  @ResModel({ type: Models.USER })
  async updateName(@User() user: Document, @Body() input: UpdateNameDTO) {
    return await this.accountService.updateName(user, input);
  }

  @Patch('phone')
  @ResModel({ type: Models.USER })
  async updatePhone(
    @User() user: Document,
    @Body() updatePhoneDto: UpdatePhoneDTO,
  ) {
    await this.accountService.updatePhone(user, updatePhoneDto);
  }

  @Patch('password')
  @ResModel({ type: Models.USER })
  async updatePassword(
    @User() user: Document,
    @Body() input: UpdatePasswordDTO,
  ) {
    return await this.accountService.updatePassword(user, input);
  }

  @Public()
  @Post(['sessions/email', 'sessions'])
  @ResModel(Models.SESSION)
  async createEmailSession(
    @User() user: Document,
    @Body() input: CreateEmailSessionDTO,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    return await this.accountService.createEmailSession(
      user,
      input,
      request,
      response,
    );
  }

  @Get('sessions')
  @ResModel({ type: Models.SESSION, list: true })
  async getSessions(@User() user: Document) {
    return await this.accountService.getSessions(user);
  }

  @Delete('sessions')
  @ResModel({ type: Models.NONE })
  async deleteSessions(
    @User() user: Document,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    return await this.accountService.deleteSessions(user, request, response);
  }

  @Get('sessions/:id')
  @ResModel(Models.SESSION)
  async getSession(@User() user: Document, @Param('id') sessionId: string) {
    return await this.accountService.getSession(user, sessionId);
  }

  @Delete('sessions/:id')
  @ResModel(Models.NONE)
  async deleteSession(
    @User() user: Document,
    @Param('id') id: string,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    return await this.accountService.deleteSession(user, id, request, response);
  }

  @Patch('sessions/:id')
  @ResModel(Models.SESSION)
  async updateSession(@User() user: Document, @Param('id') id: string) {
    return await this.accountService.updateSession(user, id);
  }

  @Get('logs')
  @ResModel({ type: Models.LOG, list: true })
  async getLogs(@User() user: Document, @Query('queries') queries: Queries[]) {
    return await this.accountService.getLogs(user, queries);
  }

  @Get('mfa/factors')
  @ResModel(Models.MFA_FACTORS)
  async getMfaFactors(@User() user: Document) {
    return await this.accountService.getMfaFactors(user);
  }

  @Get('identities')
  @ResModel({ type: Models.IDENTITY, list: true })
  async getIdentities(
    @User() user: Document,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.accountService.getIdentities(user, queries);
  }

  @Get('identities/:id')
  @ResModel(Models.IDENTITY)
  async getIdentity(@Param('id') id: string) {
    return await this.accountService.getIdentity(id);
  }
}
