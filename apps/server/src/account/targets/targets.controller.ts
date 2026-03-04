import { Body, Controller, Param, Req, UseInterceptors } from '@nestjs/common'
import { Delete, Post, Put } from '@nuvix/core'
import { Auth, AuthType, Namespace, User } from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import { ApiInterceptor, ResponseInterceptor } from '@nuvix/core/resolvers'
import type { IResponse } from '@nuvix/utils'
import type { TargetsDoc, UsersDoc } from '@nuvix/utils/types'
import {
  CreatePushTargetDTO,
  TargetIdParamDTO,
  UpdatePushTargetDTO,
} from './DTO/target.dto'
import { TargetsService } from './targets.service'

@Controller({ version: ['1'], path: 'account/targets' })
@Namespace('account')
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth(AuthType.SESSION)
export class TargetsController {
  constructor(private readonly targetService: TargetsService) {}

  @Post('push', {
    summary: 'Create push target',
    scopes: 'targets.write',
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
    @Req() request: NuvixRequest,
  ): Promise<IResponse<TargetsDoc>> {
    return this.targetService.createPushTarget({
      ...input,
      user,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ctx: request.context,
    })
  }

  @Put(':targetId/push', {
    summary: 'Update push target',
    scopes: 'targets.write',
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
    @Req() request: NuvixRequest,
  ): Promise<IResponse<TargetsDoc>> {
    return this.targetService.updatePushTarget({
      targetId,
      ...input,
      user,
      request,
    })
  }

  @Delete(':targetId/push', {
    summary: 'Delete push target',
    scopes: 'targets.write',
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
  ): Promise<void> {
    return this.targetService.deletePushTarget({
      targetId,
      user,
    })
  }
}
