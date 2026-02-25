import {
  Body,
  Controller,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Delete, Get, Patch, Post } from '@nuvix/core'
import {
  Auth,
  AuthDatabase,
  AuthType,
  Namespace,
  QueryFilter,
} from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import { TargetsQueryPipe } from '@nuvix/core/pipes/queries'
import {
  ApiInterceptor,
  ProjectGuard,
  ResponseInterceptor,
} from '@nuvix/core/resolvers'
import type { Database, Query } from '@nuvix/db'
import { IListResponse, IResponse } from '@nuvix/utils'
import { TargetsDoc } from '@nuvix/utils/types'
import { UserParamDTO } from '../DTO/user.dto'
import {
  CreateTargetDTO,
  TargetParamDTO,
  UpdateTargetDTO,
} from './DTO/target.dto'
import { TargetsService } from './targets.service'

@Namespace('users')
@Controller({ version: ['1'], path: 'users/:userId/targets' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.ADMIN, AuthType.KEY])
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

  @Post('', {
    summary: 'Create user target',
    scopes: 'targets.create',
    model: Models.TARGET,
    audit: {
      key: 'target.create',
      resource: 'target/{res.$id}',
    },
    sdk: {
      name: 'createTarget',
      descMd: '/docs/references/users/create-target.md',
    },
  })
  async addTarget(
    @Param() { userId }: UserParamDTO,
    @Body() createTargetDTO: CreateTargetDTO,
  ): Promise<IResponse<TargetsDoc>> {
    return this.targetsService.createTarget(db, userId, createTargetDTO)
  }

  @Get('', {
    summary: 'List user targets',
    scopes: 'targets.read',
    model: {
      type: Models.TARGET,
      list: true,
    },
    sdk: {
      name: 'listTargets',
      descMd: '/docs/references/users/list-user-targets.md',
    },
  })
  async getTargets(
    @Param() { userId }: UserParamDTO,
    @QueryFilter(TargetsQueryPipe) queries?: Query[],
  ): Promise<IListResponse<TargetsDoc>> {
    return this.targetsService.getTargets(db, userId, queries)
  }

  @Get(':targetId', {
    summary: 'Get user target',
    scopes: 'targets.read',
    model: Models.TARGET,
    sdk: {
      name: 'getTarget',
      descMd: '/docs/references/users/get-user-target.md',
    },
  })
  async getTarget(
    @Param() { userId, targetId }: TargetParamDTO,
  ): Promise<IResponse<TargetsDoc>> {
    return this.targetsService.getTarget(db, userId, targetId)
  }

  @Patch(':targetId', {
    summary: 'Update user target',
    scopes: 'targets.update',
    model: Models.TARGET,
    audit: {
      key: 'target.update',
      resource: 'target/{res.$id}',
    },
    sdk: {
      name: 'updateTarget',
      descMd: '/docs/references/users/update-target.md',
    },
  })
  async updateTarget(
    @Param() { userId, targetId }: TargetParamDTO,
    @Body() input: UpdateTargetDTO,
  ): Promise<IResponse<TargetsDoc>> {
    return this.targetsService.updateTarget(db, userId, targetId, input)
  }

  @Delete(':targetId', {
    summary: 'Delete user target',
    scopes: 'targets.delete',
    model: Models.NONE,
    audit: {
      key: 'target.delete',
      resource: 'target/{params.targetId}',
    },
    sdk: {
      name: 'deleteTarget',
      descMd: '/docs/references/users/delete-target.md',
    },
  })
  async deleteTarget(
    @Param() { userId, targetId }: TargetParamDTO,
  ): Promise<void> {
    return this.targetsService.deleteTarget(db, userId, targetId)
  }
}
