import { TransformStringToBoolean } from '@nuvix/core/validators';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class RoleQueryDTO {
  @IsOptional()
  @TransformStringToBoolean()
  @IsBoolean()
  include_default_roles?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}
