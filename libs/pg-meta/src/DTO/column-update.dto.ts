import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'

export class ColumnUpdateDTO {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  type?: string

  @IsOptional()
  @IsBoolean()
  drop_default?: boolean

  @IsOptional()
  default_value?: any

  @IsOptional()
  @IsEnum(['expression', 'literal'])
  @ApiPropertyOptional({ enum: ['expression', 'literal'] })
  default_value_format?: 'expression' | 'literal'

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
  is_unique?: boolean

  @IsOptional()
  @IsString()
  comment?: string

  @IsOptional()
  @IsString()
  check?: string
}
