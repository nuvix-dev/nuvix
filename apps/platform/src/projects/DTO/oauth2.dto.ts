import { oAuthProviders } from '@nuvix/core/config'
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class oAuth2DTO {
  /**
   * Provider Name
   */
  @IsIn(Object.keys(oAuthProviders))
  declare provider: string

  /**
   * Provider app ID. Max length: 256 chars.
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  appId?: string

  /**
   * Provider secret key. Max length: 512 chars.
   */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  secret?: string

  /**
   * Provider status. Set to \'false\' to disable new session creation.
   */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
