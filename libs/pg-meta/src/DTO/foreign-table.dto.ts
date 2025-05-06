import { TransformStringToBoolean } from '@nuvix/core/validators';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class ForeignTableQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;

  @IsOptional()
  @TransformStringToBoolean()
  @IsBoolean()
  include_columns?: boolean;
}
