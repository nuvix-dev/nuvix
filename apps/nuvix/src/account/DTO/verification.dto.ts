import { IsUrl, IsOptional, IsNotEmpty, IsString } from 'class-validator';

export class CreateEmailVerificationDTO {
  @IsOptional()
  @IsUrl()
  url?: string;
}

export class UpdateEmailVerificationDTO {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  secret: string;
}

export class UpdatePhoneVerificationDTO extends UpdateEmailVerificationDTO {}
