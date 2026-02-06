import { OmitType, PartialType } from '@nestjs/swagger'
import { IsOptional, IsPhoneNumber, IsString } from 'class-validator'
import { CreateProviderDTO } from './base.dto'

export class CreateVonageProviderDTO extends CreateProviderDTO {
  /**
   * Sender Phone number. Format this number with a leading \'+\' and a country code, e.g., +16175551212.
   */
  @IsOptional()
  @IsPhoneNumber()
  from?: string

  /**
   * Vonage API key.
   */
  @IsOptional()
  @IsString()
  apiKey?: string

  /**
   * Vonage API secret.
   */
  @IsOptional()
  @IsString()
  apiSecret?: string
}

export class UpdateVonageProviderDTO extends PartialType(
  OmitType(CreateVonageProviderDTO, ['providerId'] as const),
) {}
