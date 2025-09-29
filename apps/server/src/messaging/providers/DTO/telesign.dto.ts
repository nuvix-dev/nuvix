import { PartialType, OmitType } from '@nestjs/swagger'
import { IsString, IsOptional, IsPhoneNumber } from 'class-validator'
import { CreateProviderDTO } from './base.dto'

export class CreateTelesignProviderDTO extends CreateProviderDTO {
  /**
   * Sender Phone number. Format this number with a leading \'+\' and a country code, e.g., +16175551212.
   */
  @IsOptional()
  @IsPhoneNumber()
  from?: string

  /**
   * Telesign customer ID.
   */
  @IsOptional()
  @IsString()
  customerId?: string

  /**
   * Telesign API key.
   */
  @IsOptional()
  @IsString()
  apiKey?: string
}

export class UpdateTelesignProviderDTO extends PartialType(
  OmitType(CreateTelesignProviderDTO, ['providerId'] as const),
) {}
