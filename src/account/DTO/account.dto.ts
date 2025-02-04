import {
  IsEmail,
  IsString,
  Length,
  Matches,
  IsOptional,
  IsObject,
  IsNotEmpty,
} from 'class-validator';

export class CreateAccountDTO {
  @Matches(/^(?:[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}|unique\(\))$/, {
    message:
      'User ID must be either "unique()" or alphanumeric and can include period, hyphen, and underscore. Cannot start with a special character. Max length is 36 chars.',
  })
  userId: string;

  @IsEmail({}, { message: 'Invalid email address.' })
  email: string;

  @Length(8, 256, { message: 'Password must be between 8 and 256 characters.' })
  password: string;

  @IsOptional()
  @IsString()
  @Length(0, 128, {
    message: 'User name can have a maximum length of 128 characters.',
  })
  name?: string;
}

export class UpdatePrefsDTO {
  @IsObject()
  prefs: { [key: string]: any };
}

export class UpdateEmailDTO {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}

export class UpdatePasswordDTO {
  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsString()
  oldPassword: string;
}

export class UpdateNameDTO {
  @IsNotEmpty()
  @IsString()
  name: string;
}

export class UpdatePhoneDTO {
  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
