import { TransformStringToBoolean } from '@nuvix/core/validators';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class FunctionQueryDTO {
  @IsOptional()
  @TransformStringToBoolean()
  @IsBoolean()
  include_system_schemas?: boolean;

  @IsOptional()
  @IsString()
  included_schemas?: string;

  @IsOptional()
  @IsString()
  excluded_schemas?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}
