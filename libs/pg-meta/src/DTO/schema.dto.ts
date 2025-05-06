import { TransformStringToBoolean } from '@nuvix/core/validators';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class SchemaQueryDto {
  @IsOptional()
  @TransformStringToBoolean()
  @IsBoolean()
  include_system_schemas?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}
