import {
  Controller,
  Body,
  Param,
  UseInterceptors,
  VERSION_NEUTRAL,
} from '@nestjs/common'
import { ProjectService } from './projects.service'

// DTO
import { oAuth2DTO } from './DTO/oauth2.dto'
import { CreateJwtDTO } from './DTO/create-jwt.dto'
import { ProjectParamsDTO } from './DTO/create-project.dto'
import { UpdateProjectDTO } from './DTO/update-project.dto'
import {
  ProjectApiStatusAllDTO,
  ProjectApiStatusDTO,
} from './DTO/project-api.dto'
import {
  UpdateProjectAllServiceDTO,
  UpdateProjectServiceDTO,
} from './DTO/project-service.dto'
import { SmtpTestsDTO, UpdateSmtpDTO } from './DTO/smtp.dto'

import { ResponseInterceptor } from '@nuvix/core/resolvers'
import { Models } from '@nuvix/core/helpers'
import type { Query as Queries } from '@nuvix/db'
import { ConsoleInterceptor } from '@nuvix/core/resolvers'
import {
  Auth,
  AuthType,
  Namespace,
  QueryFilter,
  QuerySearch,
} from '@nuvix/core/decorators'
import { ProjectsQueryPipe } from '@nuvix/core/pipes/queries'
import { Get, Patch, Post } from '@nuvix/core'
import { ProjectsDoc } from '@nuvix/utils/types'
import { IListResponse, IResponse } from '@nuvix/utils'

@Namespace('projects')
@Controller({ version: ['1', VERSION_NEUTRAL], path: 'projects' })
@Auth(AuthType.ADMIN)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class ProjectsController {
  constructor(private readonly projectService: ProjectService) {}

  @Get('', {
    summary: 'List projects',
    scopes: 'projects.read',
    model: { type: Models.PROJECT, list: true },
    sdk: {
      name: 'list',
      descMd: '/docs/references/projects/list.md',
    },
  })
  async findAll(
    @QueryFilter(ProjectsQueryPipe) queries: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<ProjectsDoc>> {
    return this.projectService.findAll(queries, search)
  }

  @Get(':projectId', {
    summary: 'Get project',
    scopes: 'projects.read',
    model: Models.PROJECT,
    sdk: {
      name: 'get',
      descMd: '/docs/references/projects/get.md',
    },
  })
  async findOne(
    @Param() { projectId }: ProjectParamsDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return await this.projectService.findOne(projectId)
  }

  @Patch(':projectId', {
    summary: 'Update project',
    scopes: 'projects.update',
    model: Models.PROJECT,
    audit: {
      key: 'project.update',
      resource: 'project/{params.projectId}',
    },
    sdk: {
      name: 'update',
      descMd: '/docs/references/projects/update.md',
    },
  })
  async update(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() updateProjectDTO: UpdateProjectDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.projectService.update(projectId, updateProjectDTO)
  }

  @Post(':projectId/jwts', {
    summary: 'Create JWT',
    scopes: 'projects.update',
    model: Models.JWT,
    sdk: {
      name: 'createJWT',
      descMd: '/docs/references/projects/create-jwt.md',
    },
  })
  createJwt(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: CreateJwtDTO,
  ): Promise<IResponse<{ jwt: string }>> {
    return this.projectService.createJwt(projectId, input)
  }

  @Patch(':projectId/service', {
    summary: 'Update service status',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateServiceStatus',
      descMd: '/docs/references/projects/update-service-status.md',
    },
  })
  async updateService(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: UpdateProjectServiceDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.projectService.updateServiceStatus(projectId, input)
  }

  @Patch(':projectId/service/all', {
    summary: 'Update all service status',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateServiceStatusAll',
      descMd: '/docs/references/projects/update-service-status-all.md',
    },
  })
  async updateServiceAll(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: UpdateProjectAllServiceDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.projectService.updateAllServiceStatus(projectId, input.status)
  }

  @Patch(':projectId/api', {
    summary: 'Update API status',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateApiStatus',
      descMd: '/docs/references/projects/update-api-status.md',
    },
  })
  async updateApi(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: ProjectApiStatusDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.projectService.updateApiStatus(projectId, input)
  }

  @Patch(':projectId/api/all', {
    summary: 'Update all API status',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateApiStatusAll',
      descMd: '/docs/references/projects/update-api-status-all.md',
    },
  })
  async updateApiAll(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: ProjectApiStatusAllDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.projectService.updateAllApiStatus(projectId, input.status)
  }

  @Patch(':projectId/oauth2', {
    summary: 'Update project OAuth2',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateOAuth2',
      descMd: '/docs/references/projects/update-oauth2.md',
    },
  })
  async updateOAuth2(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: oAuth2DTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.projectService.updateOAuth2(projectId, input)
  }

  @Patch(':projectId/smtp', {
    summary: 'Update SMTP',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateSmtp',
      descMd: '/docs/references/projects/update-smtp.md',
    },
  })
  async updateSMTP(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: UpdateSmtpDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.projectService.updateSMTP(projectId, input)
  }

  @Post(':projectId/smtp/tests', {
    summary: 'Create SMTP test',
    scopes: 'projects.read',
    sdk: {
      name: 'createSmtpTest',
      descMd: '/docs/references/projects/create-smtp-test.md',
    },
    docs: false,
  })
  async testSMTP(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: SmtpTestsDTO,
  ): Promise<void> {
    return this.projectService.testSMTP(projectId, input)
  }
}
