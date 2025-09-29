import {
  Controller,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { SessionsService } from './sessions.service'
import { Models } from '@nuvix/core/helper/response.helper'
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor'
import {
  Namespace,
  Project,
  AuthDatabase,
  Locale,
  Auth,
  AuthType,
} from '@nuvix/core/decorators'
import type { Database } from '@nuvix/db'
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard'
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor'
import type { ProjectsDoc, SessionsDoc } from '@nuvix/utils/types'
import type { LocaleTranslator } from '@nuvix/core/helper'
import { UserParamDTO } from '../DTO/user.dto'
import { Delete, Get, Post } from '@nuvix/core'
import { IListResponse, IResponse } from '@nuvix/utils'
import { SessionParamDTO } from './DTO/session.dto'

@Namespace('users')
@Controller({ version: ['1'], path: 'users/:userId/sessions' })
@UseGuards(ProjectGuard)
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
    @AuthDatabase() db: Database,
    @Param() { userId }: UserParamDTO,
    @Locale() localeTranslater: LocaleTranslator,
  ): Promise<IListResponse<SessionsDoc>> {
    return this.sessionsService.getSessions(db, userId, localeTranslater)
  }

  @Post('', {
    summary: 'Create session',
    scopes: 'users.update',
    model: Models.SESSION,
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
    @AuthDatabase() db: Database,
    @Param() { userId }: UserParamDTO,
    @Req() req: NuvixRequest,
    @Project() project: ProjectsDoc,
    @Locale() localeTranslater: LocaleTranslator,
  ): Promise<IResponse<SessionsDoc>> {
    return this.sessionsService.createSession(
      db,
      userId,
      req.headers['user-agent'] || 'UNKNOWN',
      req.ip,
      project,
      localeTranslater,
    )
  }

  @Delete('', {
    summary: 'Delete user sessions',
    scopes: 'users.update',
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
  async deleteSessions(
    @AuthDatabase() db: Database,
    @Param() { userId }: UserParamDTO,
  ): Promise<void> {
    return this.sessionsService.deleteSessions(db, userId)
  }

  @Delete(':sessionId', {
    summary: 'Delete user session',
    scopes: 'users.update',
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
    @AuthDatabase() db: Database,
    @Param() { userId }: UserParamDTO,
    @Param() { sessionId }: SessionParamDTO,
  ): Promise<void> {
    return this.sessionsService.deleteSession(db, userId, sessionId)
  }
}
