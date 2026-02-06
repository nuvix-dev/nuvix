import { OmitType } from '@nestjs/swagger'
import { services } from '@nuvix/core/config'
import { IsBoolean, IsIn } from 'class-validator'

export class UpdateProjectServiceDTO {
  /**
   * Service name.
   */
  @IsIn(
    Object.values(services)
      .filter(v => v.optional)
      .map(value => value.key),
  )
  declare service: string

  /**
   * Service status.
   */
  @IsBoolean()
  declare status: boolean
}

export class UpdateProjectAllServiceDTO extends OmitType(
  UpdateProjectServiceDTO,
  ['service'] as const,
) {}
