import { IsUID } from '@nuvix/core/validators/input.validator.js';
import { IsUrl, IsOptional, IsNotEmpty, IsString } from 'class-validator';

export class CreateEmailVerificationDTO {
  @IsOptional()
  @IsUrl()
  url?: string;
}

export class UpdateEmailVerificationDTO {
  @IsUID()
  userId!: string;

  @IsNotEmpty()
  @IsString()
  secret!: string;
}

export class UpdatePhoneVerificationDTO extends UpdateEmailVerificationDTO {}
