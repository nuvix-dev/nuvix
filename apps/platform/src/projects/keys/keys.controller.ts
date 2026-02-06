import {
  Body,
  Controller,
  Param,
  UseInterceptors,
  VERSION_NEUTRAL,
} from '@nestjs/common'
import { Delete, Get, Post, Put } from '@nuvix/core'
import { Auth, AuthType, Namespace } from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import { ConsoleInterceptor, ResponseInterceptor } from '@nuvix/core/resolvers'
import { IListResponse, IResponse } from '@nuvix/utils'
import { KeysDoc } from '@nuvix/utils/types'
import { ProjectParamsDTO } from '../DTO/create-project.dto'
// DTO
import { CreateKeyDTO, KeyParamsDTO, UpdateKeyDTO } from './DTO/keys.dto'
import { KeysService } from './keys.service'

@Namespace('projects')
@Controller({
  version: ['1', VERSION_NEUTRAL],
  path: 'projects/:projectId/keys',
})
@Auth(AuthType.ADMIN)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  @Get('', {
    summary: 'List keys',
    scopes: 'projects.read',
    model: { type: Models.KEY, list: true },
    sdk: {
      name: 'listKeys',
      descMd: '/docs/references/projects/list-keys.md',
    },
  })
  async getKeys(
    @Param() { projectId }: ProjectParamsDTO,
  ): Promise<IListResponse<KeysDoc>> {
    return await this.keysService.getKeys(projectId)
  }

  @Post('', {
    summary: 'Create key',
    scopes: 'projects.update',
    model: Models.KEY,
    sdk: {
      name: 'createKey',
      descMd: '/docs/references/projects/create-key.md',
    },
  })
  async createKey(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: CreateKeyDTO,
  ): Promise<IResponse<KeysDoc>> {
    return this.keysService.createKey(projectId, input)
  }

  @Get(':keyId', {
    summary: 'Get key',
    scopes: 'projects.read',
    model: Models.KEY,
    sdk: {
      name: 'getKey',
      descMd: '/docs/references/projects/get-key.md',
    },
  })
  async getKey(
    @Param() { keyId, projectId }: KeyParamsDTO,
  ): Promise<IResponse<KeysDoc>> {
    return this.keysService.getKey(projectId, keyId)
  }

  @Put(':keyId', {
    summary: 'Update key',
    scopes: 'projects.update',
    model: Models.KEY,
    sdk: {
      name: 'updateKey',
      descMd: '/docs/references/projects/update-key.md',
    },
  })
  async updateKey(
    @Param() { keyId, projectId }: KeyParamsDTO,
    @Body() input: UpdateKeyDTO,
  ): Promise<IResponse<KeysDoc>> {
    return this.keysService.updateKey(projectId, keyId, input)
  }

  @Delete(':keyId', {
    summary: 'Delete key',
    scopes: 'projects.update',
    model: Models.NONE,
    sdk: {
      name: 'deleteKey',
      descMd: '/docs/references/projects/delete-key.md',
    },
  })
  async deleteKey(@Param() { keyId, projectId }: KeyParamsDTO): Promise<void> {
    return this.keysService.deleteKey(projectId, keyId)
  }
}
