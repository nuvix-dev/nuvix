import { IsString, IsOptional, IsArray, ArrayNotEmpty } from 'class-validator';

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
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  command?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  roles?: string[];
}
