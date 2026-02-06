import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator'

export class TriggerCreateDTO {
  @IsString()
  @IsNotEmpty()
  declare name: string

  @IsString()
  @IsNotEmpty()
  declare table: string

  @IsString()
  @IsNotEmpty()
  declare function_name: string

  @IsString()
  @IsNotEmpty()
  @IsIn(['BEFORE', 'AFTER', 'INSTEAD OF'])
  declare activation: string

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'], { each: true })
  declare events: string[]

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  function_schema?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  schema?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(['ROW', 'STATEMENT'])
  orientation?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  condition?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  function_args?: string[]

  @IsOptional()
  @IsString()
  comment?: string

  @IsOptional()
  @IsIn(['ORIGIN', 'REPLICA', 'ALWAYS', 'DISABLED'])
  enabled_mode?: 'ORIGIN' | 'REPLICA' | 'ALWAYS' | 'DISABLED'
}
