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
import { Response } from 'src/core/helper/response.helper';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import {
  ResolverInterceptor,
  ResponseType,
} from 'src/core/resolver/response.resolver';
import { Query as Queries } from '@nuvix/database';
import { User } from 'src/core/resolver/user.resolver';
import { CreateOrgDTO, UpdateOrgDTO, UpdateTeamPrefsDTO } from './dto/team.dto';
import { AuthGuard } from 'src/core/resolver/guards/auth.guard';
import { CreateMembershipDTO, UpdateMembershipDTO } from './dto/membership.dto';
import { ConsoleInterceptor } from 'src/core/resolver/console.resolver';

@Controller({
  version: ['1'],
  path: 'console/organizations',
})
@UseGuards(AuthGuard)
@UseInterceptors(ResolverInterceptor, ConsoleInterceptor)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ResponseType({ type: Response.MODEL_ORGANIZATION, list: true })
  async findOrganizations(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.organizationsService.findAll(queries, search);
  }

  @Post()
  @ResponseType(Response.MODEL_ORGANIZATION)
  async create(@User() user: any, @Body() input: CreateOrgDTO) {
    return await this.organizationsService.create(user, input);
  }

  @Get(':id')
  @ResponseType(Response.MODEL_ORGANIZATION)
  async findOne(@Param('id') id: string) {
    return await this.organizationsService.findOne(id);
  }

  @Put(':id')
  @ResponseType(Response.MODEL_ORGANIZATION)
  async update(@Param('id') id: string, @Body() input: UpdateOrgDTO) {
    return await this.organizationsService.update(id, input);
  }

  @Delete(':id')
  @ResponseType({ type: Response.MODEL_NONE })
  async remove(@Param('id') id: string) {
    return await this.organizationsService.remove(id);
  }

  @Get(':id/prefs')
  @ResponseType(Response.MODEL_PREFERENCES)
  async getPrefs(@Param('id') id: string) {
    return await this.organizationsService.getPrefs(id);
  }

  @Put(':id/prefs')
  @ResponseType(Response.MODEL_PREFERENCES)
  async setPrefs(@Param('id') id: string, @Body() input: UpdateTeamPrefsDTO) {
    return await this.organizationsService.setPrefs(id, input);
  }

  @Get(':id/logs')
  @ResponseType({ type: Response.MODEL_LOG, list: true })
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
  @ResponseType({ type: Response.MODEL_MEMBERSHIP, list: true })
  async getMemberships(
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.organizationsService.getMembers(id, queries, search);
  }

  @Post(':id/memberships')
  @ResponseType(Response.MODEL_MEMBERSHIP)
  async addMembership(
    @Param('id') id: string,
    @Body() input: CreateMembershipDTO,
  ) {
    return await this.organizationsService.addMember(id, input);
  }

  @Get(':id/memberships/:membershipId')
  @ResponseType(Response.MODEL_MEMBERSHIP)
  async getMembership(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return await this.organizationsService.getMember(id, membershipId);
  }

  @Patch(':id/memberships/:membershipId')
  @ResponseType(Response.MODEL_MEMBERSHIP)
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
  @ResponseType(Response.MODEL_NONE)
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
  @ResponseType(Response.MODEL_BILLING_PLAN)
  async getPlan(@Param('id') id: string) {
    return await this.organizationsService.billingPlan(id);
  }

  @Get(':id/usage')
  async getUsage(@Param('id') id: string) {
    return;
  }
}
