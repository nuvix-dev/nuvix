import { OmitType, PartialType } from '@nestjs/swagger'
import { IsString, IsPhoneNumber, IsOptional } from 'class-validator'
import { CreateProviderDTO } from './base.dto'

export class CreateTextmagicProviderDTO extends CreateProviderDTO {
  /**
   * Sender Phone number. Format this number with a leading \'+\' and a country code, e.g., +16175551212.
   */
  @IsPhoneNumber()
  @IsOptional()
  from?: string

  /**
   * Textmagic username.
   */
  @IsString()
  @IsOptional()
  username?: string

  /**
   * Textmagic apiKey.
   */
  @IsString()
  @IsOptional()
  apiKey?: string
}

export class UpdateTextmagicProviderDTO extends PartialType(
  OmitType(CreateTextmagicProviderDTO, ['providerId'] as const),
) {}
