import { OmitType, PickType } from '@nestjs/swagger'
import { IsUID } from '@nuvix/core/validators'
import { configuration } from '@nuvix/utils'
import {
  IsString,
  IsUrl,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayMaxSize,
  IsNotEmpty,
  IsEmail,
  IsBoolean,
  IsPhoneNumber,
} from 'class-validator'

export class CreateOAuth2TokenDTO {
  /**
   * URL to redirect back to your app after a successful login attempt.  Only URLs from hostnames in your project\'s platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.
   */
  @IsOptional()
  @IsUrl()
  success?: string

  /**
   * URL to redirect back to your app after a failed login attempt.  Only URLs from hostnames in your project\'s platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.
   */
  @IsOptional()
  @IsUrl()
  failure?: string

  /**
   * Array of OAuth2 scopes.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(configuration.limits.arrayElementSize, { each: true })
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  scopes: string[] = []
}

export class CreateMagicURLTokenDTO {
  /**Unique Id. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\'t start with a special char. Max length is 36 chars. If the email address has never been used, a new account is created using the provided userId. Otherwise, if the email address is already attached to an account, the user ID is ignored. */
  @IsUID()
  declare userId: string

  /**
   * User email.
   */
  @IsNotEmpty()
  @IsEmail()
  declare email: string

  /**
   * URL to redirect the user back to your app from the magic URL login. Only URLs from hostnames in your project platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.
   */
  @IsOptional()
  @IsUrl()
  url?: string

  /**
   * Toggle for security phrase. If enabled, email will be send with a randomly generated phrase and the phrase will also be included in the response. Confirming phrases match increases the security of your authentication flow.
   */
  @IsOptional()
  @IsBoolean()
  phrase?: boolean = false
}

export class CreateEmailTokenDTO extends OmitType(CreateMagicURLTokenDTO, [
  'url',
] as const) {}

export class CreatePhoneTokenDTO extends PickType(CreateMagicURLTokenDTO, [
  'userId',
] as const) {
  /**
   * Phone number. Format this number with a leading \'+\' and a country code, e.g., +16175551212.
   */
  @IsNotEmpty()
  @IsPhoneNumber()
  @IsString()
  declare phone: string
}
