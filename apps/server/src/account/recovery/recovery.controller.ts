import {
  Body,
  Controller,
  Post,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Database } from '@nuvix/db'
import {
  AuditEvent,
  Namespace,
  Scope,
  Throttle,
} from '@nuvix/core/decorators'
import { Locale } from '@nuvix/core/decorators/locale.decorator'
import { ResModel } from '@nuvix/core/decorators/res-model.decorator'
import { AuthDatabase, Project } from '@nuvix/core/decorators/project.decorator'
import { User } from '@nuvix/core/decorators/project-user.decorator'
import { LocaleTranslator } from '@nuvix/core/helper/locale.helper'
import { Models } from '@nuvix/core/helper/response.helper'
import { Public } from '@nuvix/core/resolvers/guards/auth.guard'
import { ProjectGuard } from '@nuvix/core/resolvers/guards'
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor'
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor'
import { CreateRecoveryDTO, UpdateRecoveryDTO } from './DTO/recovery.dto'
import type { ProjectsDoc, UsersDoc } from '@nuvix/utils/types'
import { RecoveryService } from './recovery.service'

@Controller({ version: ['1'], path: 'account/recovery' })
@Namespace('account')
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Public()
  @Scope('sessions.update')
  @Throttle({
    limit: 10,
    key: ({ body, ip }) => [`email:${body['email']}`, `ip:${ip}`],
  })
  @AuditEvent('recovery.create', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'createRecovery',
    description: 'Create account recovery request',
  })
  async createRecovery(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateRecoveryDTO,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
    @Req() request: NuvixRequest,
  ) {
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

  @Public()
  @Put()
  @Post()
  @Scope('sessions.update')
  @ResModel(Models.TOKEN)
  @Throttle({
    limit: 10,
    key: 'ip:{ip},userId:{param-userId}',
  })
  @AuditEvent('recovery.update', {
    resource: 'user/{res.userId}',
    userId: '{res.userId}',
  })
  @Sdk({
    name: 'updateRecovery',
    description: 'Update account recovery request',
  })
  async updateRecovery(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: UpdateRecoveryDTO,
    @Project() project: ProjectsDoc,
  ) {
    // TODO: validate newPassword with password dictionry
    return this.recoveryService.updateRecovery({
      db,
      user,
      input,
      project,
    })
  }
}
