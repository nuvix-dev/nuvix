import {
  IsString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsEnum,
} from 'class-validator';

export class PolicyCreateDto {
  @IsString()
  name: string;

  @IsString()
  table: string;

  @IsOptional()
  @IsString()
  schema?: string;

  @IsOptional()
  @IsString()
  definition?: string;

  @IsOptional()
  @IsString()
  check?: string;

  @IsOptional()
  @IsEnum(['PERMISSIVE', 'RESTRICTIVE'])
  action?: 'PERMISSIVE' | 'RESTRICTIVE';

  @IsOptional()
  @IsEnum(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'])
  command?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  roles?: string[];
}
