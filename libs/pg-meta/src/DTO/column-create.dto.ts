import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator'

export class ColumnCreateDTO {
  @IsString()
  declare name: string

  @IsNumber()
  declare table_id: number

  @IsString()
  declare type: string

  @IsOptional()
  @IsBoolean()
  is_identity?: boolean

  @IsOptional()
  @IsEnum(['ALWAYS', 'BY DEFAULT'])
  @ApiPropertyOptional({ enum: ['ALWAYS', 'BY DEFAULT'] })
  identity_generation?: 'ALWAYS' | 'BY DEFAULT'

  @IsOptional()
  @IsBoolean()
  is_nullable?: boolean

  @IsOptional()
  @IsBoolean()
  is_primary_key?: boolean

  @IsOptional()
  @IsBoolean()
  is_unique?: boolean

  @IsOptional()
  default_value?: any

  @IsOptional()
  @IsEnum(['expression', 'literal'])
  @ApiPropertyOptional({ enum: ['expression', 'literal'] })
  default_value_format?: 'expression' | 'literal'

  @IsOptional()
  @IsString()
  comment?: string

  @IsOptional()
  @IsString()
  check?: string
}
