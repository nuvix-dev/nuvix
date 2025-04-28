import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class SchemaQueryDto {
  @IsOptional()
  @IsBoolean()
  includeSystemSchemas?: boolean;

  @IsOptional()
  @IsInt()
  limit?: number;

  @IsOptional()
  @IsInt()
  offset?: number;
}
