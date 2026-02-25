import {
  Body,
  Controller,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { AuditDoc } from '@nuvix/audit'
import { Delete, Get, Post, Put } from '@nuvix/core'
import {
  Auth,
  AuthDatabase,
  AuthType,
  Namespace,
  QueryFilter,
  QuerySearch,
  User,
} from '@nuvix/core/decorators'
import { Exception } from '@nuvix/core/extend/exception'
import { Models } from '@nuvix/core/helpers'
import { TeamsQueryPipe } from '@nuvix/core/pipes/queries'
import {
  ApiInterceptor,
  ProjectGuard,
  ResponseInterceptor,
} from '@nuvix/core/resolvers'
import { Database, Query as Queries } from '@nuvix/db'
import { IListResponse, IResponse } from '@nuvix/utils'
import { TeamsDoc } from '@nuvix/utils/types'
import {
  CreateTeamDTO,
  TeamsParamDTO,
  UpdateTeamDTO,
  UpdateTeamPrefsDTO,
} from './DTO/team.dto'
import { TeamsService } from './teams.service'

@Namespace('teams')
@UseGuards(ProjectGuard)
@Auth([AuthType.KEY, AuthType.SESSION, AuthType.JWT, AuthType.ADMIN])
@Controller({ version: ['1'], path: 'teams' })
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post('', {
    summary: 'Create team',
    scopes: ['teams.create'],
    model: Models.TEAM,
    audit: {
      key: 'teams.create',
      resource: 'team/{res.$teamId}',
    },
    sdk: {
      name: 'create',
      descMd: '/docs/references/teams/create-team.md',
    },
  })
  async create(

    @User() user: any,
    @Body() input: CreateTeamDTO,
  ): Promise<IResponse<TeamsDoc>> {
    return this.teamsService.create(db, user, input)
  }

  @Get('', {
    summary: 'List teams',
    scopes: ['teams.read'],
    model: { type: Models.TEAM, list: true },
    sdk: {
      name: 'list',
      descMd: '/docs/references/teams/list-teams.md',
    },
  })
  async findAll(

    @QueryFilter(TeamsQueryPipe) queries?: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<TeamsDoc>> {
    return this.teamsService.findAll(db, queries, search)
  }

  @Get(':teamId', {
    summary: 'Get team',
    scopes: ['teams.read'],
    model: Models.TEAM,
    sdk: {
      name: 'get',
      descMd: '/docs/references/teams/get-team.md',
    },
  })
  async findOne(

    @Param() { teamId }: TeamsParamDTO,
  ): Promise<IResponse<TeamsDoc>> {
    return this.teamsService.findOne(db, teamId)
  }

  @Put(':teamId', {
    summary: 'Update name',
    scopes: ['teams.update'],
    model: Models.TEAM,
    audit: {
      key: 'teams.update',
      resource: 'team/{res.$id}',
    },
    sdk: {
      name: 'updateName',
      descMd: '/docs/references/teams/update-team-name.md',
    },
  })
  async update(

    @Param() { teamId }: TeamsParamDTO,
    @Body() input: UpdateTeamDTO,
  ): Promise<IResponse<TeamsDoc>> {
    return this.teamsService.update(db, teamId, input)
  }

  @Delete(':teamId', {
    summary: 'Delete team',
    scopes: ['teams.delete'],
    model: Models.NONE,
    audit: {
      key: 'teams.delete',
      resource: 'team/{params.teamId}',
      userId: '{user.$id}',
    },
    sdk: {
      name: 'delete',
      descMd: '/docs/references/teams/delete-team.md',
    },
  })
  async remove(

    @Param() { teamId }: TeamsParamDTO,
  ): Promise<void> {
    return this.teamsService.remove(db, teamId)
  }

  @Get(':teamId/prefs', {
    summary: 'Get team preferences',
    scopes: ['teams.read'],
    model: Models.PREFERENCES,
    sdk: {
      name: 'getPrefs',
      descMd: '/docs/references/teams/get-team-prefs.md',
    },
  })
  async getPrefs(

    @Param() { teamId }: TeamsParamDTO,
  ): Promise<IResponse<Record<string, unknown>>> {
    return this.teamsService.getPrefs(db, teamId)
  }

  @Put(':teamId/prefs', {
    summary: 'Update preferences',
    scopes: ['teams.update'],
    model: Models.PREFERENCES,
    auth: [AuthType.SESSION, AuthType.JWT],
    audit: {
      key: 'teams.update',
      resource: 'team/{params.teamId}',
      userId: '{user.$id}',
    },
    sdk: {
      name: 'updatePrefs',
      descMd: '/docs/references/teams/update-team-prefs.md',
    },
  })
  async setPrefs(

    @Param() { teamId }: TeamsParamDTO,
    @Body() input: UpdateTeamPrefsDTO,
  ): Promise<IResponse<Record<string, unknown>>> {
    return this.teamsService.setPrefs(db, teamId, input)
  }

  @Get(':teamId/logs', {
    summary: 'List team logs',
    scopes: ['teams.read'],
    model: { type: Models.LOG, list: true },
    sdk: {
      name: 'listLogs',
      descMd: '/docs/references/teams/get-team-logs.md',
    },
    docs: false, // remove or set true after implementation
  })
  async teamLogs(
    @AuthDatabase() _db: Database,
    @Param() { teamId }: TeamsParamDTO,
  ): Promise<IListResponse<AuditDoc>> {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED)
  }
}
