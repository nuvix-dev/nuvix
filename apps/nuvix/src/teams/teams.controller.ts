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
import { Database, Doc, Query as Queries } from '@nuvix-tech/db';
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard';
import { Mode } from '@nuvix/core/decorators/mode.decorator';
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor';
import {
  ProjectDatabase,
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
    @ProjectDatabase() db: Database,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.teamsService.findAll(db, queries, search);
  }

  @Post()
  @ResModel({ type: Models.TEAM })
  async create(
    @ProjectDatabase() db: Database,
    @User() user: any,
    @Body() input: CreateTeamDTO,
    @Mode() mode: string,
  ) {
    return await this.teamsService.create(db, user, input, mode);
  }

  @Get(':id')
  @ResModel({ type: Models.TEAM })
  async findOne(@ProjectDatabase() db: Database, @Param('id') id: string) {
    return await this.teamsService.findOne(db, id);
  }

  @Put(':id')
  @ResModel({ type: Models.TEAM })
  async update(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateTeamDTO,
  ) {
    return await this.teamsService.update(db, id, input);
  }

  @Delete(':id')
  @ResModel({ type: Models.NONE })
  async remove(@ProjectDatabase() db: Database, @Param('id') id: string) {
    return await this.teamsService.remove(db, id);
  }

  @Get(':id/prefs')
  async getPrefs(@ProjectDatabase() db: Database, @Param('id') id: string) {
    return await this.teamsService.getPrefs(db, id);
  }

  @Put(':id/prefs')
  async setPrefs(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateTeamPrefsDTO,
  ) {
    return await this.teamsService.setPrefs(db, id, input);
  }

  @Get(':id/logs')
  @ResModel({ type: Models.LOG, list: true })
  async teamLogs(@ProjectDatabase() db: Database, @Param('id') id: string) {
    return {
      total: 0,
      logs: [],
    };
  }

  @Post(':id/memberships')
  @ResModel({ type: Models.MEMBERSHIP })
  async addMember(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: CreateMembershipDTO,
    @Project() project: ProjectsDoc,
    @Locale() locale: LocaleTranslator,
    @User() user: UsersDoc,
  ) {
    return await this.teamsService.addMember(
      db,
      id,
      input,
      project,
      user,
      locale,
    );
  }

  @Get(':id/memberships')
  @ResModel({ type: Models.MEMBERSHIP, list: true })
  async getMembers(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.teamsService.getMembers(db, id, queries, search);
  }

  @Get(':id/memberships/:memberId')
  @ResModel({ type: Models.MEMBERSHIP })
  async getMember(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return await this.teamsService.getMember(db, id, memberId);
  }

  @Patch(':id/memberships/:memberId')
  @ResModel({ type: Models.MEMBERSHIP })
  async updateMember(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() input: UpdateMembershipDTO,
  ) {
    return await this.teamsService.updateMember(db, id, memberId, input);
  }

  @Patch(':id/memberships/:memberId/status')
  @ResModel({ type: Models.MEMBERSHIP })
  async updateMemberStatus(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() input: UpdateMembershipStatusDTO,
  ) {
    return await this.teamsService.updateMemberStatus(db, id, memberId, input);
  }

  @Delete(':id/memberships/:memberId')
  @ResModel({ type: Models.NONE })
  async removeMember(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return await this.teamsService.deleteMember(db, id, memberId);
  }
}
