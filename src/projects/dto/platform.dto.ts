import { OmitType } from '@nestjs/mapped-types';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePlatformDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  key: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  store: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  hostname: string;
}

export class UpdatePlatformDto extends OmitType(CreatePlatformDto, [
  'type',
] as const) {}
