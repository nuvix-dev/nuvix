import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator'

export class PolicyCreateDTO {
  @IsString()
  declare name: string

  @IsString()
  declare table: string

  @IsOptional()
  @IsString()
  schema?: string

  @IsOptional()
  @IsString()
  definition?: string

  @IsOptional()
  @IsString()
  check?: string

  @IsOptional()
  @IsEnum(['PERMISSIVE', 'RESTRICTIVE'])
  @ApiPropertyOptional({ enum: ['PERMISSIVE', 'RESTRICTIVE'] })
  action?: 'PERMISSIVE' | 'RESTRICTIVE'

  @IsOptional()
  @IsEnum(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'])
  @ApiPropertyOptional({
    enum: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'],
  })
  command?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL'

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  roles?: string[]
}
