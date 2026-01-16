import {
  IsEmail,
  IsString,
  Length,
  IsOptional,
  IsObject,
  IsNotEmpty,
} from 'class-validator'
import { IsCustomID } from '@nuvix/core/validators'

export class CreateAccountDTO {
  /**
   * User ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\'t start with a special char. Max length is 36 chars.')
   */
  @IsCustomID()
  declare userId: string

  /**
   * User email.
   */
  @IsEmail({}, { message: 'Invalid email address.' })
  declare email: string

  /**New user password. Must be between 8 and 256 chars. */
  @Length(8, 256, { message: 'Password must be between 8 and 256 characters.' })
  declare password: string

  /**
   * User name. Max length: 128 chars.
   */
  @IsOptional()
  @IsString()
  @Length(0, 128, {
    message: 'User name can have a maximum length of 128 characters.',
  })
  name?: string
}

export class UpdatePrefsDTO {
  /**
   * Prefs key-value JSON object.
   */
  @IsObject()
  declare prefs: { [key: string]: any }
}

export class UpdateEmailDTO {
  /**
   * User email.
   */
  @IsEmail()
  declare email: string

  /**
   * User password. Must be at least 8 chars.
   */
  @IsNotEmpty()
  @IsString()
  @Length(8, 256, { message: 'Password must be between 8 and 256 characters.' })
  declare password: string
}

export class UpdatePasswordDTO {
  /**
   * New user password. Must be at least 8 chars.
   */
  @IsNotEmpty()
  @IsString()
  @Length(8, 256, { message: 'Password must be between 8 and 256 characters.' })
  declare password: string

  /**
   * Current user password. Must be at least 8 chars.
   */
  @IsNotEmpty()
  @IsString()
  declare oldPassword: string
}

export class UpdateNameDTO {
  /**
   * User name. Max length: 128 chars.
   */
  @IsNotEmpty()
  @IsString()
  declare name: string
}

export class UpdatePhoneDTO {
  /**
   * Phone number. Format this number with a leading \'+\' and a country code, e.g., +16175551212.
   */
  @IsNotEmpty()
  @IsString()
  declare phone: string

  /**
   * User password. Must be at least 8 chars.
   */
  @IsNotEmpty()
  @IsString()
  @Length(8, 256, { message: 'Password must be between 8 and 256 characters.' })
  declare password: string
}
