import { PartialType, OmitType } from '@nestjs/swagger';
import { IsCustomID } from '@nuvix/core/validators';
import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class CreateApnsProviderDTO {
  @IsString()
  @IsCustomID()
  providerId: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsString()
  @IsOptional()
  authKey?: string;

  @IsString()
  @IsOptional()
  authKeyId?: string;

  @IsString()
  @IsOptional()
  teamId?: string;

  @IsString()
  @IsOptional()
  bundleId?: string;

  @IsBoolean()
  @IsOptional()
  sandbox?: boolean = false;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdateApnsProviderDTO extends PartialType(
  OmitType(CreateApnsProviderDTO, ['providerId']),
) {}
