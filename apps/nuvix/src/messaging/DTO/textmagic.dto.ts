import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsCustomID } from '@nuvix/core/validators';
import {
  IsString,
  IsPhoneNumber,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateTextmagicProviderDTO {
  @IsString()
  @IsCustomID()
  providerId: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsPhoneNumber()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdateTextmagicProviderDTO extends PartialType(
  OmitType(CreateTextmagicProviderDTO, ['providerId']),
) {}
