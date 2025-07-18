import { PartialType, OmitType } from '@nestjs/swagger';
import { IsCustomID } from '@nuvix/core/validators';
import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class CreateMsg91ProviderDTO {
  @IsString()
  @IsCustomID()
  providerId: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  senderId?: string;

  @IsOptional()
  @IsString()
  authKey?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateMsg91ProviderDTO extends PartialType(
  OmitType(CreateMsg91ProviderDTO, ['providerId']),
) {}
