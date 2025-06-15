import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
} from 'class-validator';

export class ColumnCreateDTO {
  @IsString()
  name: string;

  @IsNumber()
  table_id: number;

  @IsString()
  type: string;

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
  is_primary_key?: boolean;

  @IsOptional()
  @IsBoolean()
  is_unique?: boolean;

  @IsOptional()
  default_value?: any;

  @IsOptional()
  @IsEnum(['expression', 'literal'])
  default_value_format?: 'expression' | 'literal';

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  check?: string;
}
