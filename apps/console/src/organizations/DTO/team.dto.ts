import { PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

export class CreateOrgDTO {
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  billingPlan: string;

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
