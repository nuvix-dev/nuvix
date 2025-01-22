import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsDate,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateKeyDto {
  @IsString()
  @MaxLength(128)
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsArray()
  scopes: string[];

  @IsOptional()
  @IsDateString()
  expire: string;
}

export class UpdateKeyDto extends PartialType(CreateKeyDto) {}
