import { IsCustomID, TOTP } from '@nuvix/core/validators';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsIn,
  IsOptional,
} from 'class-validator';

export class UpdateAccountMfaDTO {
  @IsBoolean()
  @IsNotEmpty()
  mfa: boolean;
}

export class MfaAuthenticatorTypeParamDTO {
  @IsString()
  @IsNotEmpty()
  @IsIn([TOTP.TOTP]) // TODO: Add other supported types
  type: string;
}

export class VerifyMfaAuthenticatorDTO {
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class CreateMfaChallengeDTO {
  @IsString()
  @IsNotEmpty()
  @IsIn([TOTP.EMAIL, TOTP.PHONE, TOTP.TOTP, TOTP.RECOVERY_CODE])
  factor: string;

  @IsOptional()
  @IsString()
  @IsCustomID()
  userId?: string;
}

export class VerifyMfaChallengeDTO {
  @IsString()
  @IsNotEmpty()
  @IsCustomID()
  challengeId: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}
