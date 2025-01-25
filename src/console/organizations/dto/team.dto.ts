import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

export class CreateOrgDTO {
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  plan: string;
}

export class UpdateOrgDTO extends PartialType(CreateOrgDTO) {}

export class UpdateTeamPrefsDTO {
  @IsObject()
  prefs?: { [key: string]: any };
}
