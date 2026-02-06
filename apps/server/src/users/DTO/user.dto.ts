import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsCustomID, IsUID } from '@nuvix/core/validators'
import { configuration } from '@nuvix/utils'
import {
  ArrayMaxSize,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
} from 'class-validator'

export class CreateUserDTO {
  /**
   * User ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\'t start with a special char. Max length is 36 chars.
   */
  @IsOptional()
  @IsCustomID()
  userId?: string

  /**
   * User email.
   */
  @IsOptional()
  @IsEmail()
  email?: string

  /**
   * Phone number. Format this number with a leading \'+\' and a country code, e.g., +16175551212.
   */
  @IsOptional()
  @IsPhoneNumber()
  phone?: string

  /**
   * Plain text user password. Must be at least 8 chars.
   */
  @IsOptional()
  @Length(8)
  password?: string

  /**
   * User name. Max length: 128 chars.
   */
  @IsOptional()
  @IsString()
  @Length(1, 128)
  name?: string
}

export class CreateUserWithShaDTO extends CreateUserDTO {
  /**
   * Optional SHA version used to hash password. Allowed values are: 'sha1', 'sha224', 'sha256', 'sha384', 'sha512/224', 'sha512/256', 'sha512', 'sha3-224', 'sha3-256', 'sha3-384', 'sha3-512'
   */
  @IsOptional()
  @Matches(
    /^(sha1|sha224|sha256|sha384|sha512\/224|sha512\/256|sha512|sha3-224|sha3-256|sha3-384|sha3-512)$/,
    {
      message:
        "Optional SHA version used to hash password. Allowed values are: 'sha1', 'sha224', 'sha256', 'sha384', 'sha512/224', 'sha512/256', 'sha512', 'sha3-224', 'sha3-256', 'sha3-384', 'sha3-512'",
    },
  )
  passwordVersion?: string
}

export class CreateUserWithScryptDTO extends CreateUserDTO {
  /**
   * Optional salt used to hash password.
   */
  @IsOptional()
  @IsString()
  @Length(1, 128)
  passwordSalt?: string

  /**
   * Optional CPU cost used to hash password.
   */
  @IsOptional()
  @IsNumber()
  passwordCpu?: number

  /**
   * Optional memory cost used to hash password.
   */
  @IsOptional()
  @IsNumber()
  passwordMemory?: number

  /**
   * Optional parallelization cost used to hash password.
   */
  @IsOptional()
  @IsNumber()
  passwordParallel?: number

  /**
   * Optional hash length used to hash password.
   */
  @IsOptional()
  @IsNumber()
  passwordLength?: number
}

export class CreateUserWithScryptModifedDTO extends CreateUserDTO {
  /**
   * Salt used to hash password.
   */
  @IsOptional()
  @IsString()
  @Length(1, 128)
  passwordSalt?: string

  /**
   * Salt separator used to hash password.
   */
  @IsOptional()
  @IsString()
  @Length(1, 128)
  passwordSaltSeparator?: string

  /**
   * Signer key used to hash password.
   */
  @IsOptional()
  @IsString()
  @Length(1, 128)
  passwordSignerKey?: string
}

export class UpdateUserStatusDTO {
  /**
   * User Status. To activate the user pass `true` and to block the user pass `false`.
   */
  @IsNotEmpty()
  @IsBoolean()
  declare status: boolean
}

export class UpdateUserLabelDTO {
  @ApiPropertyOptional({
    description: `Array of user labels. Replaces the previous labels. Maximum of ${configuration.limits.arrayParamsSize} labels are allowed, each up to 36 alphanumeric characters long.`,
  })
  @IsOptional()
  @Matches(/^[a-zA-Z0-9]{1,36}$/, {
    each: true,
    message: 'Each label must be 1-36 alphanumeric characters long.',
  })
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  labels?: string[]
}

export class UpdateUserPoneVerificationDTO {
  /**
   * User phone verification status.
   */
  @IsNotEmpty()
  @IsBoolean()
  declare phoneVerification: boolean
}

export class UpdateUserEmailVerificationDTO {
  /**
   * User email verification status.
   */
  @IsNotEmpty()
  @IsBoolean()
  declare emailVerification: boolean
}

export class UpdateUserNameDTO {
  /**
   * User name. Max length: 128 chars.
   */
  @IsNotEmpty()
  @IsString()
  @Length(1, 128)
  declare name: string
}

export class UpdateUserPasswordDTO {
  /**
   * New user password. Must be at least 8 chars.
   */
  @IsNotEmpty()
  @Length(8)
  declare password: string
}

export class UpdateUserEmailDTO {
  /**
   * User email.
   */
  @IsEmail()
  declare email: string
}

export class UpdateUserPhoneDTO {
  /**
   * User phone number.
   */
  @IsPhoneNumber()
  declare phone: string
}

export class UpdateUserPrefsDTO {
  /**
   * Prefs key-value JSON object.
   */
  @IsOptional()
  @IsObject()
  prefs?: Record<string, any>
}

// Params
export class UserParamDTO {
  /**
   * User ID.
   */
  @IsUID()
  declare userId: string
}

export class IdentityParamDTO {
  /**
   * Identity ID.
   */
  @IsUID()
  declare identityId: string
}

// Query
export class RangeQueryDTO {
  /**
   * Date range.
   */
  @IsOptional()
  @IsIn(['24h', '30d', '90d'])
  range?: string = '30d'
}
