import {
  Body,
  Controller,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Delete, Get, Patch, Post } from '@nuvix/core'
import {
  Auth,
  AuthDatabase,
  AuthType,
  Locale,
  Namespace,
  Project,
  QueryFilter,
  QuerySearch,
  User,
} from '@nuvix/core/decorators'
import { LocaleTranslator, Models } from '@nuvix/core/helpers'
import { MembershipsQueryPipe } from '@nuvix/core/pipes/queries'
import {
  ApiInterceptor,
  ProjectGuard,
  ResponseInterceptor,
} from '@nuvix/core/resolvers'
import { Database, Query as Queries } from '@nuvix/db'
import { IListResponse, IResponse } from '@nuvix/utils'
import type { MembershipsDoc, ProjectsDoc, UsersDoc } from '@nuvix/utils/types'
import { TeamsParamDTO } from '../DTO/team.dto'
import {
  CreateMembershipDTO,
  MembershipParamDTO,
  UpdateMembershipDTO,
  UpdateMembershipStatusDTO,
} from './DTO/membership.dto'
import { MembershipsService } from './memberships.service'

@Namespace('teams')
@UseGuards(ProjectGuard)
@Auth([AuthType.ADMIN, AuthType.KEY, AuthType.SESSION, AuthType.JWT])
@Controller({ version: ['1'], path: 'teams/:teamId/memberships' })
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
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
    @AuthDatabase() db: Database,
    @Param() { teamId }: TeamsParamDTO,
    @Body() input: CreateMembershipDTO,
    @Project() project: ProjectsDoc,
    @Locale() locale: LocaleTranslator,
    @User() user: UsersDoc,
  ): Promise<IResponse<MembershipsDoc>> {
    return this.membershipsService.addMember(
      db,
      teamId,
      input,
      project,
      user,
      locale,
    )
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
    @AuthDatabase() db: Database,
    @Param() { teamId }: TeamsParamDTO,
    @QueryFilter(MembershipsQueryPipe) queries: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<MembershipsDoc>> {
    return this.membershipsService.getMembers(db, teamId, queries, search)
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
    @AuthDatabase() db: Database,
    @Param() { teamId, membershipId }: MembershipParamDTO,
  ): Promise<IResponse<MembershipsDoc>> {
    return this.membershipsService.getMember(db, teamId, membershipId)
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
    @AuthDatabase() db: Database,
    @Param() { teamId, membershipId }: MembershipParamDTO,
    @Body() input: UpdateMembershipDTO,
  ): Promise<IResponse<MembershipsDoc>> {
    return this.membershipsService.updateMember(db, teamId, membershipId, input)
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
    @AuthDatabase() db: Database,
    @Param() { teamId, membershipId }: MembershipParamDTO,
    @Body() input: UpdateMembershipStatusDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) res: NuvixRes,
    @User() user: UsersDoc,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<MembershipsDoc>> {
    return this.membershipsService.updateMemberStatus(
      db,
      teamId,
      membershipId,
      input,
      request,
      res,
      user,
      project,
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
    @AuthDatabase() db: Database,
    @Param() { teamId, membershipId }: MembershipParamDTO,
  ): Promise<void> {
    return this.membershipsService.deleteMember(db, teamId, membershipId)
  }
}
