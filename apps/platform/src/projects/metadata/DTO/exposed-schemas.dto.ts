import { configuration } from '@nuvix/utils'
import { ArrayMaxSize, IsArray, IsString } from 'class-validator'

export class UpdateExposedSchemasDTO {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  declare schemas: string[]
}
