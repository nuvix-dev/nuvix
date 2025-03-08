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
import { TeamsService } from './teams.service';
import { ResponseInterceptor } from 'src/core/resolvers/interceptors/response.interceptor';
import { Namespace, ResModel } from 'src/core/decorators';

import { Models } from 'src/core/helper/response.helper';
import {
  CreateTeamDTO,
  UpdateTeamDTO,
  UpdateTeamPrefsDTO,
} from './dto/team.dto';
import { User } from 'src/core/decorators/project-user.decorator';
import {
  CreateMembershipDTO,
  UpdateMembershipDTO,
  UpdateMembershipStatusDTO,
} from './dto/membership.dto';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import { Document, Query as Queries } from '@nuvix/database';
import { ProjectGuard } from 'src/core/resolvers/guards/project.guard';
import { Mode } from 'src/core/decorators/mode.decorator';
import { ApiInterceptor } from 'src/core/resolvers/interceptors/api.interceptor';
import { Project } from 'src/core/decorators/project.decorator';
import { Locale } from 'src/core/decorators/locale.decorator';
import { LocaleTranslator } from 'src/core/helper/locale.helper';

@Controller({ version: ['1'], path: 'teams' })
@UseGuards(ProjectGuard)
@Namespace('teams')
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ResModel({ type: Models.TEAM, list: true })
  async findAll(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.teamsService.findAll(queries, search);
  }

  @Post()
  @ResModel({ type: Models.TEAM })
  async create(
    @User() user: any,
    @Body() input: CreateTeamDTO,
    @Mode() mode: string,
  ) {
    return await this.teamsService.create(user, input, mode);
  }

  @Get(':id')
  @ResModel({ type: Models.TEAM })
  async findOne(@Param('id') id: string) {
    return await this.teamsService.findOne(id);
  }

  @Put(':id')
  @ResModel({ type: Models.TEAM })
  async update(@Param('id') id: string, @Body() input: UpdateTeamDTO) {
    return await this.teamsService.update(id, input);
  }

  @Delete(':id')
  @ResModel({ type: Models.NONE })
  async remove(@Param('id') id: string) {
    return await this.teamsService.remove(id);
  }

  @Get(':id/prefs')
  async getPrefs(@Param('id') id: string) {
    return await this.teamsService.getPrefs(id);
  }

  @Put(':id/prefs')
  async setPrefs(@Param('id') id: string, @Body() input: UpdateTeamPrefsDTO) {
    return await this.teamsService.setPrefs(id, input);
  }

  @Get(':id/logs')
  @ResModel({ type: Models.LOG, list: true })
  async teamLogs(@Param('id') id: string) {
    return {
      total: 0,
      logs: [],
    };
  }

  @Post(':id/memberships')
  @ResModel({ type: Models.MEMBERSHIP })
  async addMember(
    @Param('id') id: string,
    @Body() input: CreateMembershipDTO,
    @Project() project: Document,
    @Locale() locale: LocaleTranslator,
    @User() user: Document,
  ) {
    return await this.teamsService.addMember(id, input, project, user, locale);
  }

  @Get(':id/memberships')
  @ResModel({ type: Models.MEMBERSHIP, list: true })
  async getMembers(
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.teamsService.getMembers(id, queries, search);
  }

  @Get(':id/memberships/:memberId')
  @ResModel({ type: Models.MEMBERSHIP })
  async getMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return await this.teamsService.getMember(id, memberId);
  }

  @Patch(':id/memberships/:memberId')
  @ResModel({ type: Models.MEMBERSHIP })
  async updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() input: UpdateMembershipDTO,
  ) {
    return await this.teamsService.updateMember(id, memberId, input);
  }

  @Patch(':id/memberships/:memberId/status')
  @ResModel({ type: Models.MEMBERSHIP })
  async updateMemberStatus(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() input: UpdateMembershipStatusDTO,
  ) {
    return await this.teamsService.updateMemberStatus(id, memberId, input);
  }

  @Delete(':id/memberships/:memberId')
  @ResModel({ type: Models.NONE })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return await this.teamsService.deleteMember(id, memberId);
  }
}
