import { PartialType, OmitType } from '@nestjs/swagger';
import { IsCustomID } from '@nuvix/core/validators';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsPhoneNumber,
  MaxLength,
} from 'class-validator';

export class CreateTelesignProviderDTO {
  @IsString()
  @IsCustomID()
  providerId!: string;

  @IsString()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsPhoneNumber()
  from?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateTelesignProviderDTO extends PartialType(
  OmitType(CreateTelesignProviderDTO, ['providerId']),
) {}
