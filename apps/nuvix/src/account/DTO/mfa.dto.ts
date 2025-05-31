import { IsBoolean, IsNotEmpty, IsString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class UpdateAccountMfaDTO {
  @IsBoolean()
  @IsNotEmpty()
  mfa: boolean;
}

export class MfaAuthenticatorTypeParamDTO {
  @IsString()
  @IsNotEmpty()
  @IsIn(['totp']) // TODO: #AI Potentially expand with other types like 'sms', 'email' if supported
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
  @IsIn(['email', 'sms', 'totp']) // TODO: #AI Review and confirm supported factors
  factor: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  userId?: string; // Optional: If targeting a specific user, otherwise implies current user
}

export class VerifyMfaChallengeDTO {
  @IsString()
  @IsNotEmpty()
  @IsUUID() // Assuming challengeId is a UUID
  challengeId: string; // Can be a path parameter or part of the body

  @IsString()
  @IsNotEmpty()
  otp: string;
}
