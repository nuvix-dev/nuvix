import {
  Controller,
  Body,
  Param,
  UseInterceptors,
  VERSION_NEUTRAL,
} from '@nestjs/common'
import {
  CreatePlatformDTO,
  PlatformParamsDTO,
  UpdatePlatformDTO,
} from './DTO/platform.dto'
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor'
import { Models } from '@nuvix/core/helper/response.helper'
import { ConsoleInterceptor } from '@nuvix/core/resolvers/interceptors/console.interceptor'
import { Auth, AuthType, Namespace } from '@nuvix/core/decorators'
import { PlatformsService } from './platforms.service'
import { Delete, Get, Post, Put } from '@nuvix/core'
import { ProjectParamsDTO } from '../DTO/create-project.dto'
import { IListResponse, IResponse } from '@nuvix/utils'
import { PlatformsDoc } from '@nuvix/utils/types'

@Namespace('projects')
@Controller({
  version: ['1', VERSION_NEUTRAL],
  path: 'projects/:projectId/platforms',
})
@Auth(AuthType.ADMIN)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class PlatformsController {
  constructor(private readonly platformsService: PlatformsService) {}

  @Get('', {
    summary: 'Get platforms',
    scopes: 'projects.read',
    model: { type: Models.PLATFORM, list: true },
    sdk: {
      name: 'getPlatforms',
      descMd: '/docs/references/projects/get-platforms.md',
    },
  })
  async getPlatforms(
    @Param() { projectId }: ProjectParamsDTO,
  ): Promise<IListResponse<PlatformsDoc>> {
    return this.platformsService.getPlatforms(projectId)
  }

  @Post('', {
    summary: 'Create platform',
    scopes: 'projects.update',
    model: Models.PLATFORM,
    sdk: {
      name: 'createPlatform',
      descMd: '/docs/references/projects/create-platform.md',
    },
  })
  async createPlatform(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: CreatePlatformDTO,
  ): Promise<IResponse<PlatformsDoc>> {
    return this.platformsService.createPlatform(projectId, input)
  }

  @Get(':platformId', {
    summary: 'Get platform',
    scopes: 'projects.read',
    model: Models.PLATFORM,
    sdk: {
      name: 'getPlatform',
      descMd: '/docs/references/projects/get-platform.md',
    },
  })
  async getPlatform(
    @Param() { projectId, platformId }: PlatformParamsDTO,
  ): Promise<IResponse<PlatformsDoc>> {
    return this.platformsService.getPlatform(projectId, platformId)
  }

  @Put(':platformId', {
    summary: 'Update platform',
    scopes: 'projects.update',
    model: Models.PLATFORM,
    sdk: {
      name: 'updatePlatform',
      descMd: '/docs/references/projects/update-platform.md',
    },
  })
  async updatePlatform(
    @Param() { projectId, platformId }: PlatformParamsDTO,
    @Body() input: UpdatePlatformDTO,
  ): Promise<IResponse<PlatformsDoc>> {
    return this.platformsService.updatePlatform(projectId, platformId, input)
  }

  @Delete(':platformId', {
    summary: 'Delete platform',
    scopes: 'projects.update',
    sdk: {
      name: 'deletePlatform',
      descMd: '/docs/references/projects/delete-platform.md',
    },
  })
  async deletePlatform(
    @Param() { projectId, platformId }: PlatformParamsDTO,
  ): Promise<void> {
    return this.platformsService.deletePlatform(projectId, platformId)
  }
}
