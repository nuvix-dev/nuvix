import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsUID } from '@nuvix/core/validators';
import {
  IsString,
  IsPhoneNumber,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateTwilioProviderDTO {
  @IsString()
  @IsUID()
  providerId: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsPhoneNumber()
  from?: string;

  @IsOptional()
  @IsString()
  accountSid?: string;

  @IsOptional()
  @IsString()
  authToken?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateTwilioProviderDTO extends PartialType(
  OmitType(CreateTwilioProviderDTO, ['providerId']),
) {}
