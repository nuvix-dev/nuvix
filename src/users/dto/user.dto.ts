import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  Matches
} from 'class-validator';


export class CreateUserDto {
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/, {
    message: 'User ID must be 1-36 characters long, can contain a-z, A-Z, 0-9, period, hyphen, and underscore, and cannot start with a special character.',
  })
  userId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsPhoneNumber(null)
  @IsNotEmpty()
  phone: string;

  @IsNotEmpty()
  @Length(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 128)
  name: string;
}


export class CreateUserWithShaDto extends CreateUserDto {
  @IsOptional()
  @Matches(/^(sha1|sha224|sha256|sha384|sha512\/224|sha512\/256|sha512|sha3-224|sha3-256|sha3-384|sha3-512)$/, {
    message: "Optional SHA version used to hash password. Allowed values are: 'sha1', 'sha224', 'sha256', 'sha384', 'sha512/224', 'sha512/256', 'sha512', 'sha3-224', 'sha3-256', 'sha3-384', 'sha3-512'",
  })
  passwordVersion?: string;
}


export class CreateUserWithScryptDto extends CreateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  passwordSalt?: string;

  @IsOptional()
  @IsNotEmpty()
  passwordCpu?: number;

  @IsOptional()
  @IsNotEmpty()
  passwordMemory?: number;

  @IsOptional()
  @IsNotEmpty()
  passwordParallel?: number;

  @IsOptional()
  @IsNotEmpty()
  passwordLength?: number;
}

export class CreateUserWithScryptModifedDto extends CreateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  passwordSalt?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  passwordSaltSeparator?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  passwordSignerKey?: string;
}