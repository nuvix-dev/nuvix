import { IsArray, IsIn, IsOptional, IsString } from 'class-validator'

export class TriggerUpdateDTO {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsIn(['ORIGIN', 'REPLICA', 'ALWAYS', 'DISABLED'])
  enabled_mode?: 'ORIGIN' | 'REPLICA' | 'ALWAYS' | 'DISABLED'

  @IsOptional()
  @IsString()
  table?: string

  @IsOptional()
  @IsString()
  schema?: string

  @IsOptional()
  @IsString()
  condition?: string

  @IsOptional()
  @IsIn(['ROW', 'STATEMENT'])
  orientation?: 'ROW' | 'STATEMENT'

  @IsOptional()
  @IsIn(['BEFORE', 'AFTER', 'INSTEAD OF'])
  activation?: 'BEFORE' | 'AFTER' | 'INSTEAD OF'

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[]

  @IsOptional()
  @IsString()
  function_schema?: string

  @IsOptional()
  @IsString()
  function_name?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  function_args?: string[]

  @IsOptional()
  @IsString()
  comment?: string
}
