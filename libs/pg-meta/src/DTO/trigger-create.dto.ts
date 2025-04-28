import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsIn,
} from 'class-validator';

export class TriggerCreateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  table: string;

  @IsString()
  @IsNotEmpty()
  function_name: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['BEFORE', 'AFTER', 'INSTEAD OF'])
  activation: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'], { each: true })
  events: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  function_schema?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  schema?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(['ROW', 'STATEMENT'])
  orientation?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  function_args?: string[];
}
