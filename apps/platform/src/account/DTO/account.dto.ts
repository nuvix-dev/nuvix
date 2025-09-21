import { IsCustomID, IsUID } from '@nuvix/core/validators/input.validator.js';
import {
  IsEmail,
  IsString,
  Length,
  IsOptional,
  IsObject,
  IsNotEmpty,
} from 'class-validator';

export class CreateAccountDTO {
  @IsCustomID()
  declare userId: string;

  @IsEmail({}, { message: 'Invalid email address.' })
  declare email: string;

  @Length(8, 256, { message: 'Password must be between 8 and 256 characters.' })
  declare password: string;

  @IsOptional()
  @IsString()
  @Length(0, 128, {
    message: 'User name can have a maximum length of 128 characters.',
  })
  name?: string;
}

export class UpdatePrefsDTO {
  @IsObject()
  declare prefs: { [key: string]: any };
}

export class UpdateEmailDTO {
  @IsEmail()
  declare email: string;

  @IsNotEmpty()
  @IsString()
  declare password: string;
}

export class UpdatePasswordDTO {
  @IsNotEmpty()
  @IsString()
  declare password: string;

  @IsNotEmpty()
  @IsString()
  declare oldPassword: string;
}

export class UpdateNameDTO {
  @IsNotEmpty()
  @IsString()
  declare name: string;
}

export class UpdatePhoneDTO {
  @IsNotEmpty()
  @IsString()
  declare phone: string;

  @IsNotEmpty()
  @IsString()
  declare password: string;
}
