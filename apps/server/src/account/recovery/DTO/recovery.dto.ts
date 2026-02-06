import { IsUID } from '@nuvix/core/validators'
import { IsEmail, IsNotEmpty, IsString, IsUrl, Length } from 'class-validator'

export class CreateRecoveryDTO {
  /**
   * User email.
   */
  @IsEmail()
  declare email: string

  /**
   * URL to redirect the user back to your app from the recovery email. Only URLs from hostnames in your project platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.
   */
  @IsNotEmpty()
  @IsUrl()
  declare url: string
}

export class UpdateRecoveryDTO {
  /**
   * User ID.
   */
  @IsUID()
  declare userId: string

  /**
   * Valid reset token.
   */
  @IsNotEmpty()
  @IsString()
  declare secret: string

  /**
   * New user password. Must be between 8 and 256 chars.
   */
  @IsNotEmpty()
  @IsString()
  @Length(8, 256, { message: 'Password must be between 8 and 256 characters.' })
  declare password: string
}
