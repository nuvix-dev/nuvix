import { IsEmail, IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class CreateRecoveryDTO {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsUrl()
  url: string;
}

export class UpdateRecoveryDTO {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  secret: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
