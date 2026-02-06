import { localeCodes } from '@nuvix/core/config'
import { IsIn, IsString } from 'class-validator'
import { ProjectParamsDTO } from '../../DTO/create-project.dto'

export class TemplateParamsDTO extends ProjectParamsDTO {
  /**
   * Template type
   */
  @IsString()
  declare type: string

  /**
   * Template locale
   */
  @IsIn(localeCodes.map(l => l.code))
  declare locale: (typeof localeCodes)[number]['code']
}
