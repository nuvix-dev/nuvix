import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { TransformStringToBoolean } from '@nuvix/core/validators';

export class TablePrivilegeQueryDTO {
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
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  offset?: number;
}
