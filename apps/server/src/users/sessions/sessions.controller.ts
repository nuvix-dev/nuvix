import { Controller, Param, Req, UseInterceptors } from '@nestjs/common'
import { Delete, Get, Post } from '@nuvix/core'
import { Auth, AuthType, Locale, Namespace } from '@nuvix/core/decorators'
import type { LocaleTranslator } from '@nuvix/core/helpers'
import { Models } from '@nuvix/core/helpers'
import { ApiInterceptor, ResponseInterceptor } from '@nuvix/core/resolvers'
import { IListResponse, IResponse } from '@nuvix/utils'
import type { SessionsDoc } from '@nuvix/utils/types'
import { UserParamDTO } from '../DTO/user.dto'
import { SessionParamDTO } from './DTO/session.dto'
import { SessionsService } from './sessions.service'

@Namespace('users')
@Controller({ version: ['1'], path: 'users/:userId/sessions' })
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.ADMIN, AuthType.KEY])
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('', {
    summary: 'List user sessions',
    scopes: 'users.read',
    model: { type: Models.SESSION, list: true },
    sdk: {
      name: 'listSessions',
      descMd: '/docs/references/users/list-user-sessions.md',
    },
  })
  async getSessions(
    @Param() { userId }: UserParamDTO,
    @Locale() localeTranslater: LocaleTranslator,
  ): Promise<IListResponse<SessionsDoc>> {
    return this.sessionsService.getSessions(userId, localeTranslater)
  }

  @Post('', {
    summary: 'Create session',
    scopes: 'users.write',
    model: Models.SESSION,
    secretFields: ['secret'],
    audit: {
      key: 'session.create',
      resource: 'user/{res.userId}',
    },
    sdk: {
      name: 'createSession',
      descMd: '/docs/references/users/create-session.md',
    },
  })
  async createSession(
    @Param() { userId }: UserParamDTO,
    @Req() req: NuvixRequest,
  ): Promise<IResponse<SessionsDoc>> {
    return this.sessionsService.createSession(
      userId,
      req.headers['user-agent'] || 'UNKNOWN',
      req.ip,
      req.context,
    )
  }

  @Delete('', {
    summary: 'Delete user sessions',
    scopes: 'users.write',
    model: Models.NONE,
    audit: {
      key: 'sessions.delete',
      resource: 'user/{params.userId}',
    },
    sdk: {
      name: 'deleteSessions',
      descMd: '/docs/references/users/delete-user-sessions.md',
    },
  })
  async deleteSessions(@Param() { userId }: UserParamDTO): Promise<void> {
    return this.sessionsService.deleteSessions(userId)
  }

  @Delete(':sessionId', {
    summary: 'Delete user session',
    scopes: 'users.write',
    model: Models.NONE,
    audit: {
      key: 'session.delete',
      resource: 'user/{params.userId}',
    },
    sdk: {
      name: 'deleteSession',
      descMd: '/docs/references/users/delete-user-session.md',
    },
  })
  async deleteSession(
    @Param() { userId }: UserParamDTO,
    @Param() { sessionId }: SessionParamDTO,
  ): Promise<void> {
    return this.sessionsService.deleteSession(userId, sessionId)
  }
}
