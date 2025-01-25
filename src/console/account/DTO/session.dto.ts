import { IsEmail, MinLength } from 'class-validator';

export class CreateEmailSessionDTO {
  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;
}
