import { Controller, Param, UseGuards, UseInterceptors } from '@nestjs/common'
import { Delete, Get } from '@nuvix/core'
import {
  Auth,
  AuthType,
  Namespace,
  QueryFilter,
  Scope,
  User,
} from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import { IdentitiesQueryPipe } from '@nuvix/core/pipes/queries'
import { ApiInterceptor, ResponseInterceptor } from '@nuvix/core/resolvers'
import { Database, Query as Queries } from '@nuvix/db'
import type { IListResponse } from '@nuvix/utils'
import type { IdentitiesDoc, UsersDoc } from '@nuvix/utils/types'
import { IdentityIdParamDTO } from './DTO/identity.dto'
import { IdentityService } from './identity.service'

@Controller({ version: ['1'], path: 'account/identities' })
@Namespace('account')
@Scope('account')
@Auth([AuthType.SESSION, AuthType.JWT])

@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get('', {
    summary: 'List identities',
    model: {
      type: Models.IDENTITY,
      list: true,
    },
    sdk: {
      name: 'listIdentities',
      descMd: '/docs/references/account/list-identities.md',
    },
  })
  async getIdentities(
    @User() user: UsersDoc,

    @QueryFilter(IdentitiesQueryPipe) queries?: Queries[],
  ): Promise<IListResponse<IdentitiesDoc>> {
    return this.identityService.getIdentities({ user, queries })
  }

  @Delete(':identityId', {
    summary: 'Delete identity',
    model: Models.NONE,
    audit: {
      key: 'identity.delete',
      resource: 'user/{user.$id}/identity/{params.identityId}',
      userId: '{user.$id}',
    },
    sdk: {
      name: 'deleteIdentity',
      descMd: '/docs/references/account/delete-identity.md',
    },
  })
  async deleteIdentity(
    @Param() { identityId }: IdentityIdParamDTO,
  ): Promise<void> {
    return this.identityService.deleteIdentity({
      identityId,
    })
  }
}
