import {
  Controller,
  Body,
  Param,
  UseInterceptors,
  VERSION_NEUTRAL,
} from '@nestjs/common'

import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor'
import { Models } from '@nuvix/core/helper/response.helper'
import { ConsoleInterceptor } from '@nuvix/core/resolvers/interceptors/console.interceptor'
import { Auth, AuthType, Namespace } from '@nuvix/core/decorators'
import { MetadataService } from './metadata.service'
import { Put } from '@nuvix/core'
import { ProjectParamsDTO } from '../DTO/create-project.dto'
import type { IResponse } from '@nuvix/utils'
import type { ProjectsDoc } from '@nuvix/utils/types'
import { UpdateExposedSchemasDTO } from './DTO/exposed-schemas.dto'

@Namespace('projects')
@Controller({
  version: ['1', VERSION_NEUTRAL],
  path: 'projects/:projectId/metadata',
})
@Auth(AuthType.ADMIN)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Put('exposed-schemas', {
    summary: 'Update Exposed Schemas',
    scopes: 'projects.update',
    model: Models.PROJECT,
  })
  async updateExposedSchemas(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() { schemas }: UpdateExposedSchemasDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.metadataService.updateExposedSchemas(projectId, schemas)
  }
}
