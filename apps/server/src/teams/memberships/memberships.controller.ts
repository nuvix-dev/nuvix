import {
  Body,
  Controller,
  Param,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common'
import { Delete, Get, Patch, Post } from '@nuvix/core'
import {
  AllowSessionType,
  Auth,
  AuthType,
  Ctx,
  Namespace,
  QueryFilter,
  QuerySearch,
  User,
} from '@nuvix/core/decorators'
import { Models, RequestContext } from '@nuvix/core/helpers'
import { MembershipsQueryPipe } from '@nuvix/core/pipes/queries'
import { ApiInterceptor, ResponseInterceptor } from '@nuvix/core/resolvers'
import { Query as Queries } from '@nuvix/db'
import { IListResponse, IResponse, SessionType } from '@nuvix/utils'
import type { MembershipsDoc, UsersDoc } from '@nuvix/utils/types'
import { TeamsParamDTO } from '../DTO/team.dto'
import {
  CreateMembershipDTO,
  MembershipParamDTO,
  UpdateMembershipDTO,
  UpdateMembershipStatusDTO,
} from './DTO/membership.dto'
import { MembershipsService } from './memberships.service'

@Namespace('teams')
@Auth([AuthType.ADMIN, AuthType.KEY, AuthType.SESSION, AuthType.JWT])
@Controller({ version: ['1'], path: 'teams/:teamId/memberships' })
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post('', {
    summary: 'Create team membership',
    scopes: ['teams.write'],
    model: Models.MEMBERSHIP,
    secretFields: ['secret'],
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
  @AllowSessionType(SessionType.INVITES)
  async addMember(
    @Param() { teamId }: TeamsParamDTO,
    @Body() input: CreateMembershipDTO,
    @User() user: UsersDoc,
    @Ctx() ctx: RequestContext,
  ): Promise<IResponse<MembershipsDoc>> {
    return this.membershipsService.addMember(teamId, input, user, ctx)
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
    secretFields: ['secret'],
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
    scopes: ['teams.write'],
    model: Models.MEMBERSHIP,
    auth: [AuthType.KEY, AuthType.JWT, AuthType.SESSION],
    secretFields: ['secret'],
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
    @Ctx() ctx: RequestContext,
  ): Promise<IResponse<MembershipsDoc>> {
    return this.membershipsService.updateMember(
      teamId,
      membershipId,
      input,
      ctx,
    )
  }

  @Patch(':membershipId/status', {
    summary: 'Update team membership status',
    scopes: ['teams.write'],
    model: Models.MEMBERSHIP,
    secretFields: ['secret'],
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
    scopes: ['teams.write'],
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
