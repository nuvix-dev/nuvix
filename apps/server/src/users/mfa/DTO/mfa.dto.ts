import { IsBoolean, IsIn, IsNotEmpty } from 'class-validator'
import { UserParamDTO } from '../../DTO/user.dto'
import { MfaType } from '@nuvix/core/validators'

export class UpdateMfaStatusDTO {
  /**
   * Enable or disable MFA.
   */
  @IsNotEmpty()
  @IsBoolean()
  declare mfa: boolean
}

export class MfaTypeParamDTO extends UserParamDTO {
  /**
   * Type of authenticator.
   */
  @IsIn([MfaType.TOTP])
  declare type: string
}
