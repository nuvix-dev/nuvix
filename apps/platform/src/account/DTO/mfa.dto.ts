import { ApiProperty } from '@nestjs/swagger'
import { TOTP, MfaType, IsUID } from '@nuvix/core/validators'
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsIn,
  IsOptional,
  IsEnum,
} from 'class-validator'

export class UpdateAccountMfaDTO {
  @IsBoolean()
  @IsNotEmpty()
  declare mfa: boolean
}

export class MfaAuthenticatorTypeParamDTO {
  @IsString()
  @IsNotEmpty()
  @IsIn([TOTP.TOTP])
  declare type: string
}

export class VerifyMfaAuthenticatorDTO {
  @IsString()
  @IsNotEmpty()
  declare otp: string
}

export class CreateMfaChallengeDTO {
  @IsNotEmpty()
  @IsEnum(MfaType)
  @ApiProperty({ enum: MfaType, example: MfaType.TOTP })
  declare factor: MfaType

  @IsOptional()
  @IsUID()
  userId?: string
}

export class VerifyMfaChallengeDTO {
  @IsUID()
  declare challengeId: string

  @IsString()
  @IsNotEmpty()
  declare otp: string
}
