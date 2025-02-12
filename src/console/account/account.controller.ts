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
import {
  ResolverInterceptor,
  ResponseType,
} from 'src/core/resolver/response.resolver';
import { Response } from 'src/core/helper/response.helper';
import { User } from 'src/core/resolver/user.resolver';
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
import { AuthGuard, Public } from 'src/core/resolver/guards/auth.guard';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import { ConsoleInterceptor } from 'src/core/resolver/console.resolver';

@Controller({ version: ['1'], path: 'console/account' })
@UseGuards(AuthGuard)
@UseInterceptors(ResolverInterceptor, ConsoleInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Public()
  @Post()
  @ResponseType({ type: Response.MODEL_USER })
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
  @ResponseType({ type: Response.MODEL_USER })
  async getAccount(@User() user: Document) {
    return user;
  }

  @Get('prefs')
  @ResponseType({ type: Response.MODEL_PREFERENCES })
  getPrefs(@User() user: Document) {
    return user.getAttribute('prefs', {});
  }

  @Patch('prefs')
  @ResponseType({ type: Response.MODEL_PREFERENCES })
  async updatePrefs(@User() user: Document, @Body() input: UpdatePrefsDTO) {
    return await this.accountService.updatePrefs(user, input.prefs);
  }

  @Patch('email')
  @ResponseType({ type: Response.MODEL_USER })
  async updateEmail(
    @User() user: Document,
    @Body() updateEmailDto: UpdateEmailDTO,
  ) {
    return await this.accountService.updateEmail(user, updateEmailDto);
  }

  @Patch('name')
  @ResponseType({ type: Response.MODEL_USER })
  async updateName(@User() user: Document, @Body() input: UpdateNameDTO) {
    return await this.accountService.updateName(user, input);
  }

  @Patch('phone')
  @ResponseType({ type: Response.MODEL_USER })
  async updatePhone(
    @User() user: Document,
    @Body() updatePhoneDto: UpdatePhoneDTO,
  ) {
    await this.accountService.updatePhone(user, updatePhoneDto);
  }

  @Patch('password')
  @ResponseType({ type: Response.MODEL_USER })
  async updatePassword(
    @User() user: Document,
    @Body() input: UpdatePasswordDTO,
  ) {
    return await this.accountService.updatePassword(user, input);
  }

  @Public()
  @Post(['sessions/email', 'sessions'])
  @ResponseType(Response.MODEL_SESSION)
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
  @ResponseType({ type: Response.MODEL_SESSION, list: true })
  async getSessions(@User() user: Document) {
    return await this.accountService.getSessions(user);
  }

  @Delete('sessions')
  @ResponseType({ type: Response.MODEL_NONE })
  async deleteSessions(
    @User() user: Document,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    return await this.accountService.deleteSessions(user, request, response);
  }

  @Get('sessions/:id')
  @ResponseType(Response.MODEL_SESSION)
  async getSession(@User() user: Document, @Param('id') sessionId: string) {
    return await this.accountService.getSession(user, sessionId);
  }

  @Delete('sessions/:id')
  @ResponseType(Response.MODEL_NONE)
  async deleteSession(
    @User() user: Document,
    @Param('id') id: string,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    return await this.accountService.deleteSession(user, id, request, response);
  }

  @Patch('sessions/:id')
  @ResponseType(Response.MODEL_SESSION)
  async updateSession(@User() user: Document, @Param('id') id: string) {
    return await this.accountService.updateSession(user, id);
  }

  @Get('logs')
  @ResponseType({ type: Response.MODEL_LOG, list: true })
  async getLogs(@User() user: Document, @Query('queries') queries: Queries[]) {
    return await this.accountService.getLogs(user, queries);
  }

  @Get('mfa/factors')
  @ResponseType(Response.MODEL_MFA_FACTORS)
  async getMfaFactors(@User() user: Document) {
    return await this.accountService.getMfaFactors(user);
  }

  @Get('identities')
  @ResponseType({ type: Response.MODEL_IDENTITY, list: true })
  async getIdentities(
    @User() user: Document,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.accountService.getIdentities(user, queries);
  }

  @Get('identities/:id')
  @ResponseType(Response.MODEL_IDENTITY)
  async getIdentity(@Param('id') id: string) {
    return await this.accountService.getIdentity(id);
  }
}
