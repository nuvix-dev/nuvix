import {
  Body,
  Controller,
  Param,
  Req,
  Res,
  UseInterceptors,
  VERSION_NEUTRAL,
} from '@nestjs/common'
import { MembershipsService } from './memberships.service'
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor'
import {
  Auth,
  AuthType,
  Namespace,
  QueryFilter,
  QuerySearch,
} from '@nuvix/core/decorators'

import { Models } from '@nuvix/core/helper/response.helper'
import { User } from '@nuvix/core/decorators/project-user.decorator'
import {
  CreateMembershipDTO,
  MembershipParamDTO,
  UpdateMembershipDTO,
  UpdateMembershipStatusDTO,
} from './DTO/membership.dto'
import { Query as Queries } from '@nuvix/db'
import type { MembershipsDoc, UsersDoc } from '@nuvix/utils/types'
import { MembershipsQueryPipe } from '@nuvix/core/pipes/queries'
import { Delete, Get, Patch, Post } from '@nuvix/core'
import { TeamsParamDTO } from '../DTO/team.dto'
import { IListResponse, IResponse } from '@nuvix/utils'
import { ConsoleInterceptor } from '@nuvix/core/resolvers'

@Namespace('teams')
@Auth([AuthType.SESSION, AuthType.JWT])
@Controller({
  version: ['1', VERSION_NEUTRAL],
  path: 'teams/:teamId/memberships',
})
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post('', {
    summary: 'Create team membership',
    scopes: ['teams.create', 'teams.update'],
    model: Models.MEMBERSHIP,
    audit: {
      key: 'membership.create',
      resource: 'team/{params.teamId}',
      userId: '{req.userId}',
    },
    sdk: {
      name: 'createMembership',
      descMd: '/docs/references/teams/create-team-membership.md',
    },
  })
  async addMember(
    @Param() { teamId }: TeamsParamDTO,
    @Body() input: CreateMembershipDTO,
  ): Promise<IResponse<MembershipsDoc>> {
    return this.membershipsService.addMember(teamId, input) as any
  }

  @Get('', {
    summary: 'List team memberships',
    scopes: ['teams.read'],
    model: { type: Models.MEMBERSHIP, list: true },
    sdk: {
      name: 'listMemberships',
      descMd: '/docs/references/teams/list-team-members.md',
    },
  })
  async getMembers(
    @Param() { teamId }: TeamsParamDTO,
    @QueryFilter(MembershipsQueryPipe) queries: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<MembershipsDoc>> {
    return this.membershipsService.getMembers(teamId, queries, search)
  }

  @Get(':membershipId', {
    summary: 'Get team membership',
    scopes: ['teams.read'],
    model: Models.MEMBERSHIP,
    sdk: {
      name: 'getMembership',
      descMd: '/docs/references/teams/get-team-member.md',
    },
  })
  async getMember(
    @Param() { teamId, membershipId }: MembershipParamDTO,
  ): Promise<IResponse<MembershipsDoc>> {
    return this.membershipsService.getMember(teamId, membershipId)
  }

  @Patch(':membershipId', {
    summary: 'Update membership',
    scopes: ['teams.update'],
    model: Models.MEMBERSHIP,
    audit: {
      key: 'membership.update',
      resource: 'team/{req.teamId}',
    },
    sdk: {
      name: 'updateMembership',
      descMd: '/docs/references/teams/update-team-membership.md',
    },
  })
  async updateMember(
    @Param() { teamId, membershipId }: MembershipParamDTO,
    @Body() input: UpdateMembershipDTO,
  ): Promise<IResponse<MembershipsDoc>> {
    return this.membershipsService.updateMember(teamId, membershipId, input)
  }

  @Patch(':membershipId/status', {
    summary: 'Update team membership status',
    scopes: ['teams.update'],
    model: Models.MEMBERSHIP,
    audit: {
      key: 'membership.update',
      resource: 'team/{req.teamId}',
      userId: '{body.userId}',
    },
    sdk: {
      name: 'updateMembershipStatus',
      descMd: '/docs/references/teams/update-team-membership-status.md',
    },
  })
  async updateMemberStatus(
    @Param() { teamId, membershipId }: MembershipParamDTO,
    @Body() input: UpdateMembershipStatusDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) res: NuvixRes,
    @User() user: UsersDoc,
  ): Promise<IResponse<MembershipsDoc>> {
    return this.membershipsService.updateMemberStatus(
      teamId,
      membershipId,
      input,
      request,
      res,
      user,
    )
  }

  @Delete(':membershipId', {
    summary: 'Delete team membership',
    scopes: ['teams.update'],
    model: Models.NONE,
    audit: {
      key: 'membership.delete',
      resource: 'team/{params.teamId}',
    },
    sdk: {
      name: 'deleteMembership',
      descMd: '/docs/references/teams/delete-team-membership.md',
    },
  })
  async removeMember(
    @Param() { teamId, membershipId }: MembershipParamDTO,
  ): Promise<void> {
    return this.membershipsService.deleteMember(teamId, membershipId)
  }
}
