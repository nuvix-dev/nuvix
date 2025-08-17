import { OmitType, PartialType } from '@nestjs/swagger';
import { IsCustomID } from '@nuvix/core/validators';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateFcmProviderDTO {
  @IsString()
  @IsCustomID()
  providerId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsObject()
  serviceAccountJSON?: object;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateFcmProviderDTO extends PartialType(
  OmitType(CreateFcmProviderDTO, ['providerId']),
) {}
