import { PartialType } from '@nestjs/mapped-types';
import { CreateAccountDto } from './create-account.dto';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}

export class UpdateEmailDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}

export class UpdatePasswordDto {
  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsString()
  oldPassword: string;
}

export class UpdateNameDto {
  @IsNotEmpty()
  @IsString()
  name: string;
}

export class UpdatePhoneDto {
  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
