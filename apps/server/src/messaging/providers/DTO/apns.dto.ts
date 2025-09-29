import { PartialType, OmitType } from '@nestjs/swagger'
import { IsString, IsBoolean, IsOptional } from 'class-validator'
import { CreateProviderDTO } from './base.dto'

export class CreateApnsProviderDTO extends CreateProviderDTO {
  /**
   * APNS authentication key.
   */
  @IsString()
  @IsOptional()
  authKey?: string

  /**
   * APNS authentication key ID.
   */
  @IsString()
  @IsOptional()
  authKeyId?: string

  /**
   * APNS team ID.
   */
  @IsString()
  @IsOptional()
  teamId?: string

  /**
   * APNS bundle ID.
   */
  @IsString()
  @IsOptional()
  bundleId?: string

  /**
   * Use APNS sandbox environment.
   */
  @IsBoolean()
  @IsOptional()
  sandbox?: boolean = false
}

export class UpdateApnsProviderDTO extends PartialType(
  OmitType(CreateApnsProviderDTO, ['providerId'] as const),
) {}
