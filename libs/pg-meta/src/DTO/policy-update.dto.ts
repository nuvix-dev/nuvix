import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class PolicyUpdateDto {
  @IsString()
  name: string;

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
