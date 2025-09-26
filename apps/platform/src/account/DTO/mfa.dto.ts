import { ApiProperty } from '@nestjs/swagger';
import { IsCustomID, TOTP, MfaType } from '@nuvix/core/validators';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsIn,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class UpdateAccountMfaDTO {
  @IsBoolean()
  @IsNotEmpty()
  declare mfa: boolean;
}

export class MfaAuthenticatorTypeParamDTO {
  @IsString()
  @IsNotEmpty()
  @IsIn([TOTP.TOTP])
  declare type: string;
}

export class VerifyMfaAuthenticatorDTO {
  @IsString()
  @IsNotEmpty()
  declare otp: string;
}

export class CreateMfaChallengeDTO {
  @IsNotEmpty()
  @IsEnum(MfaType)
  @ApiProperty({ enum: MfaType, example: MfaType.TOTP })
  declare factor: MfaType;

  @IsOptional()
  @IsString()
  @IsCustomID()
  userId?: string;
}

export class VerifyMfaChallengeDTO {
  @IsString()
  @IsNotEmpty()
  @IsCustomID()
  declare challengeId: string;

  @IsString()
  @IsNotEmpty()
  declare otp: string;
}
