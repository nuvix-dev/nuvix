import { IsEmail, MinLength } from 'class-validator'

export class CreateEmailSessionDTO {
  /**
   * User email.
   */
  @IsEmail()
  declare email: string

  /**
   * User password. Must be at least 8 chars.
   */
  @MinLength(8)
  declare password: string
}
