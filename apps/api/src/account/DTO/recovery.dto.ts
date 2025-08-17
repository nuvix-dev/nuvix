import { IsUID } from '@nuvix/core/validators/input.validator.js';
import { IsEmail, IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class CreateRecoveryDTO {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsUrl()
  url!: string;
}

export class UpdateRecoveryDTO {
  @IsUID()
  userId!: string;

  @IsNotEmpty()
  @IsString()
  secret!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;
}
