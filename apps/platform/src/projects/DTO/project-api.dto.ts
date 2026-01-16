import { OmitType } from '@nestjs/swagger'
import { IsBoolean, IsIn } from 'class-validator'
import { apis } from '@nuvix/core/config'

export class ProjectApiStatusDTO {
  /**
   * API name.
   */
  @IsIn(Object.values(apis).map(api => api.key))
  declare api: string

  /**
   * API status.
   */
  @IsBoolean()
  declare status: boolean
}

export class ProjectApiStatusAllDTO extends OmitType(ProjectApiStatusDTO, [
  'api',
] as const) {}
