import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsUID } from '@nuvix/core/validators';
import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class CreateMsg91ProviderDTO {
  @IsString()
  @IsUID()
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

export class UpdateMsg91ProviderDTO extends PartialType(OmitType(CreateMsg91ProviderDTO, ['providerId'])) { }
