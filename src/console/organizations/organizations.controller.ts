import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
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

@Controller({ version: ['1'], path: 'console/organizations' })
@UseGuards(AuthGuard)
@UseInterceptors(ResolverInterceptor)
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
  @ResponseType({ type: Response.MODEL_ORGANIZATION })
  async create(@User() user: any, @Body() input: CreateOrgDTO) {
    return await this.organizationsService.create(user, input);
  }

  @Get(':id')
  @ResponseType({ type: Response.MODEL_ORGANIZATION })
  async findOne(@Param('id') id: string) {
    return await this.organizationsService.findOne(id);
  }

  @Put(':id')
  @ResponseType({ type: Response.MODEL_ORGANIZATION })
  async update(@Param('id') id: string, @Body() input: UpdateOrgDTO) {
    return await this.organizationsService.update(id, input);
  }

  @Delete(':id')
  @ResponseType({ type: Response.MODEL_NONE })
  async remove(@Param('id') id: string) {
    return await this.organizationsService.remove(id);
  }

  @Get(':id/prefs')
  async getPrefs(@Param('id') id: string) {
    return await this.organizationsService.getPrefs(id);
  }

  @Put(':id/prefs')
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
  async getPlan(@Param('id') id: string) {
    return {
      $id: 'tier-2',
      name: 'Scale',
      order: 20,
      price: 599,
      trial: 0,
      bandwidth: 300,
      storage: 150,
      members: 0,
      webhooks: 0,
      platforms: 0,
      users: 200000,
      teams: 0,
      databases: 0,
      buckets: 0,
      fileSize: 5000,
      functions: 0,
      executions: 3500000,
      realtime: 750,
      logs: 672,
      addons: {
        bandwidth: {
          unit: 'GB',
          price: 40,
          currency: 'USD',
          value: 100,
          multiplier: 1000000000,
          invoiceDesc:
            'Calculated for all bandwidth used across your organization.',
        },
        storage: {
          unit: 'GB',
          price: 3,
          currency: 'USD',
          value: 100,
          multiplier: 1000000000,
          invoiceDesc:
            'Calculated for all storage operations across your organization (including storage files, database data, function code, and static website hosting)',
        },
        member: {
          unit: '',
          price: 0,
          currency: 'USD',
          value: 0,
          invoiceDesc: 'Per additional member',
        },
        users: {
          unit: '',
          price: 0,
          currency: 'USD',
          value: 1000,
          invoiceDesc: 'Per 1,000 additional users',
        },
        executions: {
          unit: '',
          price: 2,
          currency: 'USD',
          value: 1000000,
          invoiceDesc: 'Every 1 million additional executions',
        },
        realtime: {
          unit: '',
          price: 5,
          currency: 'USD',
          value: 1000,
          invoiceDesc: 'Every 1000 concurrent connection',
        },
      },
      customSmtp: true,
      emailBranding: false,
      requiresPaymentMethod: true,
      requiresBillingAddress: false,
      isAvailable: true,
      selfService: true,
      premiumSupport: true,
      budgeting: true,
      supportsMockNumbers: true,
      backupsEnabled: true,
      backupPolicies: 9223372036854775807,
    };
  }

  @Get(':id/usage')
  async getUsage(@Param('id') id: string) {
    return;
  }
}
