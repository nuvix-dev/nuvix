import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { IsUID } from 'src/core/validators/input.validator';

export class CreateUserDTO {
  @IsOptional()
  @IsUID()
  userId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
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

export class CreateUserWithShaDTO extends CreateUserDTO {
  @IsOptional()
  @Matches(
    /^(sha1|sha224|sha256|sha384|sha512\/224|sha512\/256|sha512|sha3-224|sha3-256|sha3-384|sha3-512)$/,
    {
      message:
        "Optional SHA version used to hash password. Allowed values are: 'sha1', 'sha224', 'sha256', 'sha384', 'sha512/224', 'sha512/256', 'sha512', 'sha3-224', 'sha3-256', 'sha3-384', 'sha3-512'",
    },
  )
  passwordVersion?: string;
}

export class CreateUserWithScryptDTO extends CreateUserDTO {
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

export class CreateUserWithScryptModifedDTO extends CreateUserDTO {
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

export class UpdateUserStatusDTO {
  @IsNotEmpty()
  @IsBoolean()
  status: boolean;
}

export class UpdateUserLabelDTO {
  @IsOptional()
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9]{1,36}$/, {
    each: true,
    message: 'Each label must be 1-36 alphanumeric characters long.',
  })
  labels?: string[];
}

export class UpdateUserPoneVerificationDTO {
  @IsNotEmpty()
  @IsBoolean()
  phoneVerification: boolean;
}

export class UpdateUserEmailVerificationDTO {
  @IsNotEmpty()
  @IsBoolean()
  emailVerification: boolean;
}

export class UpdateUserNameDTO {
  @IsNotEmpty()
  @IsString()
  @Length(1, 128)
  name: string;
}

export class UpdateUserPasswordDTO {
  @IsNotEmpty()
  @Length(8)
  password: string;
}

export class UpdateUserEmailDTO {
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateUserPhoneDTO {
  @IsOptional()
  @IsPhoneNumber(null)
  phone?: string;
}

export class UpdateUserPrefsDTO {
  @IsOptional()
  @IsObject()
  prefs?: { [key: string]: any };
}

export class UpdateMfaStatusDTO {
  @IsNotEmpty()
  @IsBoolean()
  mfa: boolean;
}
