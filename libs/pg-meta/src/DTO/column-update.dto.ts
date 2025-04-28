import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class ColumnUpdateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsBoolean()
  drop_default?: boolean;

  @IsOptional()
  default_value?: any;

  @IsOptional()
  @IsEnum(['expression', 'literal'])
  default_value_format?: 'expression' | 'literal';

  @IsOptional()
  @IsBoolean()
  is_identity?: boolean;

  @IsOptional()
  @IsEnum(['ALWAYS', 'BY DEFAULT'])
  identity_generation?: 'ALWAYS' | 'BY DEFAULT';

  @IsOptional()
  @IsBoolean()
  is_nullable?: boolean;

  @IsOptional()
  @IsBoolean()
  is_unique?: boolean;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  check?: string;
}
