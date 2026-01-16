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
  Session,
  UseGuards,
  UseInterceptors,
  VERSION_NEUTRAL,
} from '@nestjs/common'
import { AccountService } from './account.service'
import { ResponseInterceptor } from '@nuvix/core/resolvers'
import { Models } from '@nuvix/core/helpers'
import { User } from '@nuvix/core/decorators'
import {
  AuditEvent,
  Locale,
  ResModel,
  Scope,
  Throttle,
} from '@nuvix/core/decorators'

import { AuthGuard, Public } from '@nuvix/core/resolvers'
import { ConsoleInterceptor } from '@nuvix/core/resolvers'
import { Exception } from '@nuvix/core/extend/exception'
import { LocaleTranslator } from '@nuvix/core/helpers'
import {
  CreateAccountDTO,
  UpdateEmailDTO,
  UpdateNameDTO,
  UpdatePasswordDTO,
  UpdatePrefsDTO,
} from './DTO/account.dto'
import { CreateEmailSessionDTO } from './DTO/session.dto'
import type { SessionsDoc, UsersDoc } from '@nuvix/utils/types'

@Controller({ version: ['1', VERSION_NEUTRAL], path: 'account' })
@UseGuards(AuthGuard)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  // @Public()
  @Post()
  @Scope('sessions.create')
  @ResModel(Models.ACCOUNT)
  @Throttle(10)
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
      user,
      request.ip,
    )
  }

  @Get()
  @Scope('account')
  @ResModel(Models.ACCOUNT)
  async getAccount(@User() user: UsersDoc) {
    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }
    return user
  }

  @Delete()
  @Scope('account')
  @ResModel(Models.NONE)
  @AuditEvent('user.delete', 'user/{res.$id}')
  async deleteAccount(@User() user: UsersDoc) {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED)
    // return this.accountService.deleteAccount(user)
  }

  @Get('sessions')
  @Scope('account')
  @ResModel(Models.SESSION, { list: true })
  async getSessions(
    @User() user: UsersDoc,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.getSessions(user, locale)
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
    return this.accountService.deleteSessions(user, locale, request, response)
  }

  @Get('sessions/:id')
  @Scope('account')
  @ResModel(Models.SESSION)
  async getSession(
    @User() user: UsersDoc,
    @Param('id') sessionId: string,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.accountService.getSession(user, sessionId, locale)
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
      id = session.getId()
    }
    return this.accountService.deleteSession(user, id, request, response)
  }

  @Patch('sessions/:id')
  @Scope('account')
  @ResModel(Models.SESSION)
  @AuditEvent('session.update', 'user/{res.userId}')
  async updateSession(@User() user: UsersDoc, @Param('id') id: string) {
    return this.accountService.updateSession(user, id)
  }

  @Public()
  @Post(['sessions/email', 'sessions'])
  @Scope('sessions.create')
  @ResModel(Models.SESSION)
  @Throttle(100)
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
    )
  }

  @Get('prefs')
  @Scope('account')
  @ResModel(Models.PREFERENCES)
  getPrefs(@User() user: UsersDoc) {
    return user.get('prefs', {})
  }

  @Patch('prefs')
  @Scope('account')
  @ResModel(Models.PREFERENCES)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updatePrefs(@User() user: UsersDoc, @Body() input: UpdatePrefsDTO) {
    return this.accountService.updatePrefs(user, input.prefs)
  }

  @Patch('name')
  @Scope('account')
  @ResModel(Models.ACCOUNT)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updateName(@User() user: UsersDoc, @Body() { name }: UpdateNameDTO) {
    return this.accountService.updateName(user, name)
  }

  @Patch('password')
  @Scope('account')
  @ResModel(Models.ACCOUNT)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updatePassword(
    @User() user: UsersDoc,
    @Body() input: UpdatePasswordDTO,
  ) {
    return this.accountService.updatePassword(user, input)
  }

  @Patch('email')
  @Scope('account')
  @ResModel(Models.ACCOUNT)
  @AuditEvent('user.update', 'user/{res.$id}')
  async updateEmail(
    @User() user: UsersDoc,
    @Body() updateEmailDTO: UpdateEmailDTO,
  ) {
    return this.accountService.updateEmail(user, updateEmailDTO)
  }
}
