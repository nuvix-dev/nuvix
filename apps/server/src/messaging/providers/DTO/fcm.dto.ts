import { OmitType, PartialType } from '@nestjs/swagger'
import { IsObject } from 'class-validator'
import { CreateProviderDTO } from './base.dto'

export class CreateFcmProviderDTO extends CreateProviderDTO {
  /**
   * FCM service account JSON.
   */
  @IsObject()
  declare serviceAccountJSON: object
}

export class UpdateFcmProviderDTO extends PartialType(
  OmitType(CreateFcmProviderDTO, ['providerId'] as const),
) {}
