import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsUID } from '@nuvix/core/validators';
import {
  IsString,
  IsEmail,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateSendgridProviderDTO {
  @IsString()
  @IsUID()
  providerId: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsString()
  apiKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  fromName?: string;

  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  replyToName?: string;

  @IsOptional()
  @IsEmail()
  replyToEmail?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateSendgridProviderDTO extends PartialType(
  OmitType(CreateSendgridProviderDTO, ['providerId']),
) {}
