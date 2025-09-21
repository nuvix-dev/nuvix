import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Models } from '@nuvix/core/helper/response.helper';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { Query as Queries } from '@nuvix/db';
import { User } from '@nuvix/core/decorators/user.decorator';
import { CreateOrgDTO, UpdateOrgDTO, UpdateTeamPrefsDTO } from './DTO/team.dto';
import { AuthGuard } from '@nuvix/core/resolvers/guards/auth.guard';
import { CreateMembershipDTO, UpdateMembershipDTO } from './DTO/membership.dto';
import { ConsoleInterceptor } from '@nuvix/core/resolvers/interceptors/console.interceptor';
import { ResModel } from '@nuvix/core/decorators';
import { roles } from '@nuvix/core/config/roles';
import type { UsersDoc } from '@nuvix/utils/types';
import {
  MembershipsQueryPipe,
  TeamsQueryPipe,
} from '@nuvix/core/pipes/queries';

@Controller({
  version: ['1'],
  path: 'organizations',
})
@UseGuards(AuthGuard)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ResModel({ type: Models.ORGANIZATION, list: true })
  async findOrganizations(
    @Query('queries', TeamsQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return this.organizationsService.findAll(queries, search);
  }

  @Post()
  @ResModel(Models.ORGANIZATION)
  async create(@User() user: UsersDoc, @Body() input: CreateOrgDTO) {
    return this.organizationsService.create(user, input);
  }

  @Get(':teamId')
  @ResModel(Models.ORGANIZATION)
  async findOne(@Param('teamId') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Put(':teamId')
  @ResModel(Models.ORGANIZATION)
  async update(@Param('teamId') id: string, @Body() input: UpdateOrgDTO) {
    return this.organizationsService.update(id, input);
  }

  @Delete(':teamId')
  @ResModel({ type: Models.NONE })
  async remove(@Param('teamId') id: string) {
    return this.organizationsService.remove(id);
  }

  @Get(':teamId/prefs')
  @ResModel(Models.PREFERENCES)
  async getPrefs(@Param('teamId') id: string) {
    return this.organizationsService.getPrefs(id);
  }

  @Put(':teamId/prefs')
  @ResModel(Models.PREFERENCES)
  async setPrefs(
    @Param('teamId') id: string,
    @Body() input: UpdateTeamPrefsDTO,
  ) {
    return this.organizationsService.setPrefs(id, input);
  }

  @Get(':teamId/logs')
  @ResModel({ type: Models.LOG, list: true })
  async teamLogs() {
    return {
      total: 0,
      logs: [],
    };
  }

  @Get(':teamId/aggregations')
  async findAggregations() {
    return {
      total: 0, // aggs.length,
      aggregations: {}, // aggs
    };
  }

  @Get(':teamId/memberships')
  @ResModel({ type: Models.MEMBERSHIP, list: true })
  async getMemberships(
    @Param('teamId') id: string,
    @Query('queries', MembershipsQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return this.organizationsService.getMembers(id, queries, search);
  }

  @Post(':teamId/memberships')
  @ResModel(Models.MEMBERSHIP)
  async addMembership(
    @Param('teamId') id: string,
    @Body() input: CreateMembershipDTO,
  ) {
    return this.organizationsService.addMember(id, input);
  }

  @Get(':teamId/memberships/:membershipId')
  @ResModel(Models.MEMBERSHIP)
  async getMembership(
    @Param('teamId') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.organizationsService.getMember(id, membershipId);
  }

  @Patch(':teamId/memberships/:membershipId')
  @ResModel(Models.MEMBERSHIP)
  async updateMembership(
    @Param('teamId') id: string,
    @Param('membershipId') membershipId: string,
    @Body() input: UpdateMembershipDTO,
  ) {
    return this.organizationsService.updateMember(id, membershipId, input);
  }

  @Delete(':teamId/memberships/:membershipId')
  @ResModel(Models.NONE)
  async removeMembership(
    @Param('teamId') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.organizationsService.deleteMember(id, membershipId);
  }

  @Get(':teamId/roles')
  async getRoles() {
    return {
      scopes: roles.owner.scopes,
      roles: ['owner'],
    };
  }
}
