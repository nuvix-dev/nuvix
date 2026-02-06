import { ApiProperty } from '@nestjs/swagger'
import { IsUID, TOTP } from '@nuvix/core/validators'
import { IsBoolean, IsIn, IsNotEmpty, IsString } from 'class-validator'

export class UpdateAccountMfaDTO {
  /**
   * Enable or disable MFA.
   */
  @IsBoolean()
  @IsNotEmpty()
  declare mfa: boolean
}

export class MfaAuthenticatorTypeParamDTO {
  /**
   * Type of authenticator. Must be `totp`
   */
  @IsString()
  @IsNotEmpty()
  @IsIn([TOTP.TOTP])
  declare type: string
}

export class VerifyMfaAuthenticatorDTO {
  /**
   * Valid verification token.
   */
  @IsString()
  @IsNotEmpty()
  declare otp: string
}

export class CreateMfaChallengeDTO {
  @ApiProperty({
    description: `Factor used for verification. Must be one of following: \`${TOTP.EMAIL}\`, \`${TOTP.PHONE}\`, \`${TOTP.TOTP}\`, \`${TOTP.RECOVERY_CODE}\`.`,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([TOTP.EMAIL, TOTP.PHONE, TOTP.TOTP, TOTP.RECOVERY_CODE])
  declare factor: string
}

export class VerifyMfaChallengeDTO {
  /**
   * ID of the challenge.
   */
  @IsUID()
  declare challengeId: string

  /**
   * Valid verification token.
   */
  @IsString()
  @IsNotEmpty()
  declare otp: string
}
