import { TransformStringToBoolean } from '@nuvix/core/validators'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

export class TypeQueryDTO {
  @IsOptional()
  @IsBoolean()
  @TransformStringToBoolean()
  include_array_types?: boolean

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
  @Min(1)
  @Max(1000)
  limit?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number
}
