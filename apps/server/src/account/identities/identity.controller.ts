import { Controller, Param, UseGuards, UseInterceptors } from '@nestjs/common'
import { Database } from '@nuvix/db'
import { Query as Queries } from '@nuvix/db'
import {
  Auth,
  AuthType,
  Namespace,
  QueryFilter,
  Scope,
} from '@nuvix/core/decorators'
import { AuthDatabase } from '@nuvix/core/decorators/project.decorator'
import { User } from '@nuvix/core/decorators/project-user.decorator'
import { Models } from '@nuvix/core/helper/response.helper'
import { ProjectGuard } from '@nuvix/core/resolvers/guards'
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor'
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor'
import { IdentityService } from './identity.service'
import { IdentityIdParamDTO } from './DTO/identity.dto'
import type { IdentitiesDoc, UsersDoc } from '@nuvix/utils/types'
import { IdentitiesQueryPipe } from '@nuvix/core/pipes/queries'
import { Delete, Get } from '@nuvix/core'
import type { IListResponse } from '@nuvix/utils'

@Controller({ version: ['1'], path: 'account/identities' })
@Namespace('account')
@Scope('account')
@Auth([AuthType.SESSION, AuthType.JWT])
@UseGuards(ProjectGuard)
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
    @AuthDatabase() db: Database,
    @QueryFilter(IdentitiesQueryPipe) queries?: Queries[],
  ): Promise<IListResponse<IdentitiesDoc>> {
    return this.identityService.getIdentities({ user, db, queries })
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
    @AuthDatabase() db: Database,
  ): Promise<void> {
    return this.identityService.deleteIdentity({
      identityId,
      db,
    })
  }
}
