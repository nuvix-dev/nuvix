import { IsInt, Min, Max } from 'class-validator';
import { Auth } from 'src/core/helper/auth.helper';

export class CreateTokenDto {
  @IsInt()
  @Min(4)
  @Max(128)
  length: number = 6;

  @IsInt()
  @Min(60)
  @Max(Auth.TOKEN_EXPIRATION_LOGIN_LONG)
  expire: number = Auth.TOKEN_EXPIRATION_GENERIC;
}
