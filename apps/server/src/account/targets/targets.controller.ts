import {
  Body,
  Controller,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Delete, Post, Put } from '@nuvix/core'
import {
  Auth,
  AuthDatabase,
  AuthType,
  Namespace,
  Project,
  User,
} from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import {
  ApiInterceptor,
  ProjectGuard,
  ResponseInterceptor,
} from '@nuvix/core/resolvers'
import { Database } from '@nuvix/db'
import type { IResponse } from '@nuvix/utils'
import type { ProjectsDoc, TargetsDoc, UsersDoc } from '@nuvix/utils/types'
import {
  CreatePushTargetDTO,
  TargetIdParamDTO,
  UpdatePushTargetDTO,
} from './DTO/target.dto'
import { TargetsService } from './targets.service'

@Controller({ version: ['1'], path: 'account/targets' })
@Namespace('account')
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth(AuthType.SESSION)
export class TargetsController {
  constructor(private readonly targetService: TargetsService) {}

  @Post('push', {
    summary: 'Create push target',
    scopes: 'targets.create',
    model: Models.TARGET,
    audit: {
      key: 'target.create',
      resource: 'user/{user.$id}/target/{res.$id}',
      userId: '{user.$id}',
    },
    sdk: {
      name: 'createPushTarget',
      descMd: '/docs/references/account/create-push-target.md',
    },
  })
  async createPushTarget(
    @Body() input: CreatePushTargetDTO,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Req() request: NuvixRequest,
  ): Promise<IResponse<TargetsDoc>> {
    return this.targetService.createPushTarget({
      ...input,
      user,
      db,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
    })
  }

  @Put(':targetId/push', {
    summary: 'Update push target',
    scopes: 'targets.update',
    model: Models.TARGET,
    audit: {
      key: 'target.update',
      resource: 'user/{user.$id}/target/{params.targetId}',
      userId: '{user.$id}',
    },
    sdk: {
      name: 'updatePushTarget',
      descMd: '/docs/references/account/update-push-target.md',
    },
  })
  async updatePushTarget(
    @Param() { targetId }: TargetIdParamDTO,
    @Body() input: UpdatePushTargetDTO,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Req() request: NuvixRequest,
  ): Promise<IResponse<TargetsDoc>> {
    return this.targetService.updatePushTarget({
      targetId,
      ...input,
      user,
      db,
      request,
    })
  }

  @Delete(':targetId/push', {
    summary: 'Delete push target',
    scopes: 'targets.delete',
    model: Models.NONE,
    audit: {
      key: 'target.delete',
      resource: 'user/{user.$id}/target/{params.targetId}',
      userId: '{user.$id}',
    },
    sdk: {
      name: 'deletePushTarget',
      descMd: '/docs/references/account/delete-push-target.md',
    },
  })
  async deletePushTarget(
    @Param() { targetId }: TargetIdParamDTO,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Project() project: ProjectsDoc,
  ): Promise<void> {
    return this.targetService.deletePushTarget({
      targetId,
      user,
      db,
      project,
    })
  }
}
