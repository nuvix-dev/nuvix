import {
  Body,
  Controller,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Post, Put } from '@nuvix/core'
import {
  AuthDatabase,
  Locale,
  Namespace,
  Project,
  User,
} from '@nuvix/core/decorators'
import { LocaleTranslator, Models } from '@nuvix/core/helpers'
import {
  ApiInterceptor,
  ProjectGuard,
  ResponseInterceptor,
} from '@nuvix/core/resolvers'
import { Database } from '@nuvix/db'
import type { IResponse } from '@nuvix/utils'
import type { ProjectsDoc, TokensDoc, UsersDoc } from '@nuvix/utils/types'
import { CreateRecoveryDTO, UpdateRecoveryDTO } from './DTO/recovery.dto'
import { RecoveryService } from './recovery.service'

@Controller({ version: ['1'], path: 'account/recovery' })
@Namespace('account')
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Post('', {
    summary: 'Create password recovery',
    throttle: {
      limit: 10,
      key: ({ body, ip }) => [`email:${body.email}`, `ip:${ip}`],
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
