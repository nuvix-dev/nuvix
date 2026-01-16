import {
  Body,
  Controller,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Database } from '@nuvix/db'
import { Auth, AuthType, Namespace } from '@nuvix/core/decorators'
import { Locale } from '@nuvix/core/decorators'
import { AuthDatabase, Project } from '@nuvix/core/decorators'
import { User } from '@nuvix/core/decorators'
import { LocaleTranslator } from '@nuvix/core/helpers'
import { Models } from '@nuvix/core/helpers'
import { ProjectGuard } from '@nuvix/core/resolvers'
import { ApiInterceptor } from '@nuvix/core/resolvers'
import { ResponseInterceptor } from '@nuvix/core/resolvers'
import { CreateRecoveryDTO, UpdateRecoveryDTO } from './DTO/recovery.dto'
import type { ProjectsDoc, TokensDoc, UsersDoc } from '@nuvix/utils/types'
import { RecoveryService } from './recovery.service'
import { Post, Put } from '@nuvix/core'
import type { IResponse } from '@nuvix/utils'

@Controller({ version: ['1'], path: 'account/recovery' })
@Namespace('account')
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.SESSION, AuthType.JWT])
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Post('', {
    summary: 'Create password recovery',
    scopes: 'sessions.update',
    throttle: {
      limit: 10,
      key: ({ body, ip }) => [`email:${body['email']}`, `ip:${ip}`],
    },
    audit: {
      key: 'recovery.create',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
    sdk: {
      name: 'createRecovery',
      descMd: '/docs/references/account/create-recovery.md',
    },
  })
  async createRecovery(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateRecoveryDTO,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
    @Req() request: NuvixRequest,
  ): Promise<IResponse<TokensDoc>> {
    return this.recoveryService.createRecovery({
      db,
      user,
      input,
      locale,
      project,
      ip: request.ip,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
    })
  }

  @Put('', {
    summary: 'Update password recovery (confirmation)',
    scopes: 'sessions.update',
    model: Models.TOKEN,
    throttle: {
      limit: 10,
      key: 'ip:{ip},userId:{param-userId}',
    },
    audit: {
      key: 'recovery.update',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
    sdk: {
      name: 'updateRecovery',
      descMd: '/docs/references/account/update-recovery.md',
    },
  })
  async updateRecovery(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: UpdateRecoveryDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<TokensDoc>> {
    return this.recoveryService.updateRecovery({
      db,
      user,
      input,
      project,
    })
  }
}
