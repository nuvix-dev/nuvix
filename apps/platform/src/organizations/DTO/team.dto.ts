import { PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

export class CreateOrgDTO {
  @IsString()
  @IsNotEmpty()
  declare organizationId: string;

  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsNotEmpty()
  declare billingPlan: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  billingAddressId?: string;
}

export class UpdateOrgDTO extends PartialType(CreateOrgDTO) {}

export class UpdateTeamPrefsDTO {
  @IsObject()
  prefs?: { [key: string]: any };
}
