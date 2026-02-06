import {
  Body,
  Controller,
  Param,
  UseInterceptors,
  VERSION_NEUTRAL,
} from '@nestjs/common'
import { Put } from '@nuvix/core'
import { Auth, AuthType, Namespace } from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import { ConsoleInterceptor, ResponseInterceptor } from '@nuvix/core/resolvers'
import type { IResponse } from '@nuvix/utils'
import type { ProjectsDoc } from '@nuvix/utils/types'
import { ProjectParamsDTO } from '../DTO/create-project.dto'
import { UpdateExposedSchemasDTO } from './DTO/exposed-schemas.dto'
import { MetadataService } from './metadata.service'

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
