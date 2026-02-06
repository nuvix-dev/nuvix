import { OmitType } from '@nestjs/swagger'
import { apis } from '@nuvix/core/config'
import { IsBoolean, IsIn } from 'class-validator'

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
