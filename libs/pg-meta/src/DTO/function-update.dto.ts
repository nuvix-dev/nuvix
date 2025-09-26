import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class FunctionUpdateDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  schema?: string;

  @IsOptional()
  @IsString()
  definition?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  args?: string[];

  @IsOptional()
  @IsString()
  return_type?: string;

  @IsOptional()
  @IsEnum(['IMMUTABLE', 'STABLE', 'VOLATILE'])
  @ApiPropertyOptional({ enum: ['IMMUTABLE', 'STABLE', 'VOLATILE'] })
  behavior?: 'IMMUTABLE' | 'STABLE' | 'VOLATILE';

  @IsOptional()
  @IsBoolean()
  security_definer?: boolean;

  @IsOptional()
  @IsObject()
  config_params?: Record<string, string>;

  @IsOptional()
  @IsString()
  comment?: string;
}
