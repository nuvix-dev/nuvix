import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsUID } from '@nuvix/core/validators/input.validator';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  MaxLength,
} from 'class-validator';

export class CreateMailgunProviderDTO {
  @IsString()
  @IsUID()
  providerId: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  domain?: string;

  @IsBoolean()
  @IsOptional()
  isEuRegion?: boolean;

  @IsString()
  @MaxLength(128)
  @IsOptional()
  fromName?: string;

  @IsEmail()
  @IsOptional()
  fromEmail?: string;

  @IsString()
  @MaxLength(128)
  @IsOptional()
  replyToName?: string;

  @IsEmail()
  @IsOptional()
  replyToEmail?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdateMailgunProviderDTO extends PartialType(
  OmitType(CreateMailgunProviderDTO, ['providerId']),
) {}
