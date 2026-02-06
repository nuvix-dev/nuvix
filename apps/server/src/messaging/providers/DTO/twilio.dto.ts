import { OmitType, PartialType } from '@nestjs/swagger'
import { IsOptional, IsPhoneNumber, IsString } from 'class-validator'
import { CreateProviderDTO } from './base.dto'

export class CreateTwilioProviderDTO extends CreateProviderDTO {
  /**
   * Sender Phone number. Format this number with a leading \'+\' and a country code, e.g., +16175551212.
   */
  @IsOptional()
  @IsPhoneNumber()
  from?: string

  /**
   * Twilio account secret ID.
   */
  @IsOptional()
  @IsString()
  accountSid?: string

  /**
   * Twilio authentication token.
   */
  @IsOptional()
  @IsString()
  authToken?: string
}

export class UpdateTwilioProviderDTO extends PartialType(
  OmitType(CreateTwilioProviderDTO, ['providerId'] as const),
) {}
