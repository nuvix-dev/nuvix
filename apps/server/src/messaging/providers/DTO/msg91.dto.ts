import { OmitType, PartialType } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'
import { CreateProviderDTO } from './base.dto'

export class CreateMsg91ProviderDTO extends CreateProviderDTO {
  /**
   * Msg91 template ID
   */
  @IsOptional()
  @IsString()
  templateId?: string

  /**
   * Msg91 sender ID.
   */
  @IsOptional()
  @IsString()
  senderId?: string

  /**
   * Msg91 auth key.
   */
  @IsOptional()
  @IsString()
  authKey?: string
}

export class UpdateMsg91ProviderDTO extends PartialType(
  OmitType(CreateMsg91ProviderDTO, ['providerId'] as const),
) {}
