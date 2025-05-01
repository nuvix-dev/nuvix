import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class TableQueryDto {
  @IsOptional()
  @IsBoolean()
  include_system_schemas?: boolean;

  @IsOptional()
  @IsString()
  included_schemas?: string;

  @IsOptional()
  @IsString()
  excluded_schemas?: string;

  @IsOptional()
  @IsInt()
  limit?: number;

  @IsOptional()
  @IsInt()
  offset?: number;

  @IsOptional()
  @IsBoolean()
  include_columns?: boolean;
}
