import { TransformStringToBoolean } from '@nuvix/core/validators'
import { Type } from 'class-transformer'
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator'

export class TablePrivilegeQueryDTO {
  @IsOptional()
  @IsBoolean()
  @TransformStringToBoolean()
  include_system_schemas?: boolean

  @IsOptional()
  @IsString()
  included_schemas?: string

  @IsOptional()
  @IsString()
  excluded_schemas?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  offset?: number
}
