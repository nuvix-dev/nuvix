import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransformStringToBoolean } from '@nuvix/core/validators';

export class TypeQueryDTO {
  @IsOptional()
  @IsBoolean()
  @TransformStringToBoolean()
  include_array_types?: boolean;

  @IsOptional()
  @IsBoolean()
  @TransformStringToBoolean()
  include_system_schemas?: boolean;

  @IsOptional()
  @IsString()
  included_schemas?: string;

  @IsOptional()
  @IsString()
  excluded_schemas?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number;
}
