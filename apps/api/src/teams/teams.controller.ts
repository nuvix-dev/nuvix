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
import { TeamsService } from './teams.service';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { Namespace, ResModel, Scope } from '@nuvix/core/decorators';

import { Models } from '@nuvix/core/helper/response.helper';
import {
  CreateTeamDTO,
  UpdateTeamDTO,
  UpdateTeamPrefsDTO,
} from './DTO/team.dto';
import { User } from '@nuvix/core/decorators/project-user.decorator';
import {
  CreateMembershipDTO,
  UpdateMembershipDTO,
  UpdateMembershipStatusDTO,
} from './DTO/membership.dto';
import { ParseQueryPipe } from '@nuvix/core/pipes/query.pipe';
import { Database, Query as Queries } from '@nuvix-tech/db';
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard';
import { Mode } from '@nuvix/core/decorators/mode.decorator';
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor';
import {
  AuthDatabase,
  Project,
} from '@nuvix/core/decorators/project.decorator';
import { Locale } from '@nuvix/core/decorators/locale.decorator';
import { LocaleTranslator } from '@nuvix/core/helper/locale.helper';
import type { ProjectsDoc, UsersDoc } from '@nuvix/utils/types';

@Controller({ version: ['1'], path: 'teams' })
@UseGuards(ProjectGuard)
@Namespace('teams')
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @Scope('teams.read')
  @ResModel({ type: Models.TEAM, list: true })
  async findAll(
    @AuthDatabase() db: Database,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return this.teamsService.findAll(db, queries, search);
  }

  @Post()
  @ResModel({ type: Models.TEAM })
  async create(
    @AuthDatabase() db: Database,
    @User() user: any,
    @Body() input: CreateTeamDTO,
    @Mode() mode: string,
  ) {
    return this.teamsService.create(db, user, input, mode);
  }

  @Get(':id')
  @ResModel({ type: Models.TEAM })
  async findOne(@AuthDatabase() db: Database, @Param('id') id: string) {
    return this.teamsService.findOne(db, id);
  }

  @Put(':id')
  @ResModel({ type: Models.TEAM })
  async update(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateTeamDTO,
  ) {
    return this.teamsService.update(db, id, input);
  }

  @Delete(':id')
  @ResModel({ type: Models.NONE })
  async remove(@AuthDatabase() db: Database, @Param('id') id: string) {
    return this.teamsService.remove(db, id);
  }

  @Get(':id/prefs')
  async getPrefs(@AuthDatabase() db: Database, @Param('id') id: string) {
    return this.teamsService.getPrefs(db, id);
  }

  @Put(':id/prefs')
  async setPrefs(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateTeamPrefsDTO,
  ) {
    return this.teamsService.setPrefs(db, id, input);
  }

  @Get(':id/logs')
  @ResModel({ type: Models.LOG, list: true })
  async teamLogs(@AuthDatabase() db: Database, @Param('id') id: string) {
    return {
      total: 0,
      logs: [],
    };
  }

  @Post(':id/memberships')
  @ResModel({ type: Models.MEMBERSHIP })
  async addMember(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: CreateMembershipDTO,
    @Project() project: ProjectsDoc,
    @Locale() locale: LocaleTranslator,
    @User() user: UsersDoc,
  ) {
    return this.teamsService.addMember(db, id, input, project, user, locale);
  }

  @Get(':id/memberships')
  @ResModel({ type: Models.MEMBERSHIP, list: true })
  async getMembers(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return this.teamsService.getMembers(db, id, queries, search);
  }

  @Get(':id/memberships/:memberId')
  @ResModel({ type: Models.MEMBERSHIP })
  async getMember(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teamsService.getMember(db, id, memberId);
  }

  @Patch(':id/memberships/:memberId')
  @ResModel({ type: Models.MEMBERSHIP })
  async updateMember(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() input: UpdateMembershipDTO,
  ) {
    return this.teamsService.updateMember(db, id, memberId, input);
  }

  @Patch(':id/memberships/:memberId/status')
  @ResModel({ type: Models.MEMBERSHIP })
  async updateMemberStatus(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() input: UpdateMembershipStatusDTO,
  ) {
    return this.teamsService.updateMemberStatus(db, id, memberId, input);
  }

  @Delete(':id/memberships/:memberId')
  @ResModel({ type: Models.NONE })
  async removeMember(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teamsService.deleteMember(db, id, memberId);
  }
}
