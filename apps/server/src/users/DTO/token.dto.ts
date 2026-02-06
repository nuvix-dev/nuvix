import { Auth } from '@nuvix/core/helpers'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class CreateTokenDTO {
  /**
   * Token length in characters. The default length is 6 characters
   */
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(128)
  length = 6

  /**
   * Token expiration period in seconds.
   */
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(Auth.TOKEN_EXPIRATION_LOGIN_LONG)
  expire: number = Auth.TOKEN_EXPIRATION_GENERIC
}
