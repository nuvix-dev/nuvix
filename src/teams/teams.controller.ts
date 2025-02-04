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
import {
  ResolverInterceptor,
  ResponseType,
} from 'src/core/resolver/response.resolver';
import { Response } from 'src/core/helper/response.helper';
import {
  CreateTeamDTO,
  UpdateTeamDTO,
  UpdateTeamPrefsDTO,
} from './dto/team.dto';
import { User } from 'src/core/resolver/project-user.resolver';
import {
  CreateMembershipDTO,
  UpdateMembershipDTO,
  UpdateMembershipStatusDTO,
} from './dto/membership.dto';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import { Query as Queries } from '@nuvix/database';
import { ProjectGuard } from 'src/core/resolver/guards/project.guard';
import { Mode } from 'src/core/resolver/model.resolver';

@Controller({ version: ['1'], path: 'teams' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResolverInterceptor)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ResponseType({ type: Response.MODEL_TEAM, list: true })
  async findAll(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.teamsService.findAll(queries, search);
  }

  @Post()
  @ResponseType({ type: Response.MODEL_TEAM })
  async create(
    @User() user: any,
    @Body() input: CreateTeamDTO,
    @Mode() mode: string,
  ) {
    return await this.teamsService.create(user, input, mode);
  }

  @Get(':id')
  @ResponseType({ type: Response.MODEL_TEAM })
  async findOne(@Param('id') id: string) {
    return await this.teamsService.findOne(id);
  }

  @Put(':id')
  @ResponseType({ type: Response.MODEL_TEAM })
  async update(@Param('id') id: string, @Body() input: UpdateTeamDTO) {
    return await this.teamsService.update(id, input);
  }

  @Delete(':id')
  @ResponseType({ type: Response.MODEL_NONE })
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
  @ResponseType({ type: Response.MODEL_LOG, list: true })
  async teamLogs(@Param('id') id: string) {
    return {
      total: 0,
      logs: [],
    };
  }

  @Post(':id/memberships')
  @ResponseType({ type: Response.MODEL_MEMBERSHIP })
  async addMember(@Param('id') id: string, @Body() input: CreateMembershipDTO) {
    return await this.teamsService.addMember(id, input);
  }

  @Get(':id/memberships')
  @ResponseType({ type: Response.MODEL_MEMBERSHIP, list: true })
  async getMembers(
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.teamsService.getMembers(id, queries, search);
  }

  @Get(':id/memberships/:memberId')
  @ResponseType({ type: Response.MODEL_MEMBERSHIP })
  async getMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return await this.teamsService.getMember(id, memberId);
  }

  @Patch(':id/memberships/:memberId')
  @ResponseType({ type: Response.MODEL_MEMBERSHIP })
  async updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() input: UpdateMembershipDTO,
  ) {
    return await this.teamsService.updateMember(id, memberId, input);
  }

  @Patch(':id/memberships/:memberId/status')
  @ResponseType({ type: Response.MODEL_MEMBERSHIP })
  async updateMemberStatus(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() input: UpdateMembershipStatusDTO,
  ) {
    return await this.teamsService.updateMemberStatus(id, memberId, input);
  }

  @Delete(':id/memberships/:memberId')
  @ResponseType({ type: Response.MODEL_NONE })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return await this.teamsService.deleteMember(id, memberId);
  }
}
