import { IsCustomID, IsUID } from '@nuvix/core/validators'
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'

export abstract class CreateProviderDTO {
  /**
   * Provider ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\'t start with a special char. Max length is 36 chars.
   */
  @IsCustomID()
  declare providerId: string

  /**
   * Provider name.
   */
  @IsString()
  @MaxLength(128)
  declare name: string

  /**
   * Set as enabled.
   */
  @IsBoolean()
  @IsOptional()
  enabled?: boolean
}

// Params

export class ProviderParamsDTO {
  /**
   * Provider ID.
   */
  @IsUID()
  declare providerId: string
}
