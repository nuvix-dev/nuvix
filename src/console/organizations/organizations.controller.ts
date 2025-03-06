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
  Scope,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Models } from 'src/core/helper/response.helper';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import { ResponseInterceptor } from 'src/core/resolvers/interceptors/response.interceptor';
import { Query as Queries } from '@nuvix/database';
import { User } from 'src/core/decorators/user.decorator';
import { CreateOrgDTO, UpdateOrgDTO, UpdateTeamPrefsDTO } from './dto/team.dto';
import { AuthGuard } from 'src/core/resolvers/guards/auth.guard';
import { CreateMembershipDTO, UpdateMembershipDTO } from './dto/membership.dto';
import { ConsoleInterceptor } from 'src/core/resolvers/interceptors/console.interceptor';
import { ResModel } from 'src/core/decorators';

@Controller({
  version: ['1'],
  path: 'console/organizations',
})
@UseGuards(AuthGuard)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ResModel({ type: Models.ORGANIZATION, list: true })
  async findOrganizations(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.organizationsService.findAll(queries, search);
  }

  @Post()
  @ResModel(Models.ORGANIZATION)
  async create(@User() user: any, @Body() input: CreateOrgDTO) {
    return await this.organizationsService.create(user, input);
  }

  @Get(':id')
  @ResModel(Models.ORGANIZATION)
  async findOne(@Param('id') id: string) {
    return await this.organizationsService.findOne(id);
  }

  @Put(':id')
  @ResModel(Models.ORGANIZATION)
  async update(@Param('id') id: string, @Body() input: UpdateOrgDTO) {
    return await this.organizationsService.update(id, input);
  }

  @Delete(':id')
  @ResModel({ type: Models.NONE })
  async remove(@Param('id') id: string) {
    return await this.organizationsService.remove(id);
  }

  @Get(':id/prefs')
  @ResModel(Models.PREFERENCES)
  async getPrefs(@Param('id') id: string) {
    return await this.organizationsService.getPrefs(id);
  }

  @Put(':id/prefs')
  @ResModel(Models.PREFERENCES)
  async setPrefs(@Param('id') id: string, @Body() input: UpdateTeamPrefsDTO) {
    return await this.organizationsService.setPrefs(id, input);
  }

  @Get(':id/logs')
  @ResModel({ type: Models.LOG, list: true })
  async teamLogs(@Param('id') id: string) {
    return {
      total: 0,
      logs: [],
    };
  }

  @Get(':id/aggregations')
  async findAggregations(@Param('id') id: string) {
    return {
      total: 0, // aggs.length,
      aggregations: {}, // aggs
    };
  }

  @Get(':id/memberships')
  @ResModel({ type: Models.MEMBERSHIP, list: true })
  async getMemberships(
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.organizationsService.getMembers(id, queries, search);
  }

  @Post(':id/memberships')
  @ResModel(Models.MEMBERSHIP)
  async addMembership(
    @Param('id') id: string,
    @Body() input: CreateMembershipDTO,
  ) {
    return await this.organizationsService.addMember(id, input);
  }

  @Get(':id/memberships/:membershipId')
  @ResModel(Models.MEMBERSHIP)
  async getMembership(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return await this.organizationsService.getMember(id, membershipId);
  }

  @Patch(':id/memberships/:membershipId')
  @ResModel(Models.MEMBERSHIP)
  async updateMembership(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
    @Body() input: UpdateMembershipDTO,
  ) {
    return await this.organizationsService.updateMember(
      id,
      membershipId,
      input,
    );
  }

  @Delete(':id/memberships/:membershipId')
  @ResModel(Models.NONE)
  async removeMembership(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return await this.organizationsService.deleteMember(id, membershipId);
  }

  @Get(':id/roles')
  async getRoles() {
    return {
      scopes: [
        'global',
        'public',
        'home',
        'console',
        'graphql',
        'sessions.write',
        'documents.read',
        'documents.write',
        'files.read',
        'files.write',
        'locale.read',
        'avatars.read',
        'execution.write',
        'organizations.write',
        'account',
        'teams.read',
        'projects.read',
        'users.read',
        'databases.read',
        'collections.read',
        'buckets.read',
        'assistant.read',
        'functions.read',
        'execution.read',
        'platforms.read',
        'keys.read',
        'webhooks.read',
        'rules.read',
        'migrations.read',
        'vcs.read',
        'providers.read',
        'messages.read',
        'topics.read',
        'targets.read',
        'subscribers.read',
        'teams.write',
        'targets.write',
        'subscribers.write',
        'buckets.write',
        'users.write',
        'databases.write',
        'collections.write',
        'platforms.write',
        'keys.write',
        'webhooks.write',
        'functions.write',
        'rules.write',
        'migrations.write',
        'vcs.write',
        'providers.write',
        'messages.write',
        'topics.write',
        'policies.write',
        'policies.read',
        'archives.read',
        'archives.write',
        'restorations.read',
        'restorations.write',
        'billing.read',
        'billing.write',
        'projects.write',
      ],
      roles: ['owner'],
    };
  }

  @Get(':id/credits')
  async getCredits(@Param('id') id: string) {
    return {
      total: 0, // credits.length,
      credits: [], // credits
      available: 0,
    };
  }

  @Get(':id/invoices')
  async getInvoices(@Param('id') id: string) {
    return {
      total: 0, // invoices.length,
      invoices: [], // invoices
    };
  }

  @Get(':id/plan')
  @ResModel(Models.BILLING_PLAN)
  async getPlan(@Param('id') id: string) {
    return await this.organizationsService.billingPlan(id);
  }

  @Get(':id/usage')
  async getUsage(@Param('id') id: string) {
    return;
  }
}
