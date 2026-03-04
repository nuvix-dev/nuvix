import { Body, Controller, Req, UseInterceptors } from '@nestjs/common'
import { Post, Put } from '@nuvix/core'
import { Ctx, Namespace, User } from '@nuvix/core/decorators'
import { Models, RequestContext } from '@nuvix/core/helpers'
import { ApiInterceptor, ResponseInterceptor } from '@nuvix/core/resolvers'
import type { IResponse } from '@nuvix/utils'
import type { TokensDoc, UsersDoc } from '@nuvix/utils/types'
import { CreateRecoveryDTO, UpdateRecoveryDTO } from './DTO/recovery.dto'
import { RecoveryService } from './recovery.service'

@Controller({ version: ['1'], path: 'account/recovery' })
@Namespace('account')
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Post('', {
    summary: 'Create password recovery',
    scopes: ['sessions.write'],
    model: Models.TOKEN,
    sensitiveFields: ['secret'],
    throttle: {
      limit: 10,
      key: ['url:{url},email:{body-email}', 'url:{url},ip:{ip}'],
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
    @User() user: UsersDoc,
    @Body() input: CreateRecoveryDTO,
    @Req() request: NuvixRequest,
  ): Promise<IResponse<TokensDoc>> {
    return this.recoveryService.createRecovery({
      user,
      input,
      request,
    })
  }

  @Put('', {
    summary: 'Update password recovery (confirmation)',
    model: Models.TOKEN,
    sensitiveFields: ['secret'],
    throttle: {
      limit: 10,
      key: 'url:{url},userId:{body-userId}',
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
    @User() user: UsersDoc,
    @Body() input: UpdateRecoveryDTO,
    @Ctx() ctx: RequestContext,
  ): Promise<IResponse<TokensDoc>> {
    return this.recoveryService.updateRecovery({
      user,
      input,
      ctx,
    })
  }
}
