import { oAuthProvidersList } from '@nuvix/core/config'
import { configuration } from '@nuvix/utils'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'
import { ProjectParamsDTO } from '../../DTO/create-project.dto'

export class AuthSessionAlertsDTO {
  /**
   * Set to true to enable session emails.
   */
  @IsBoolean()
  declare alerts: boolean
}

export class AuthLimitDTO {
  /**
   * Set the max number of users allowed in this project. Use 0 for unlimited.
   */
  @IsInt()
  @Min(0)
  @Max(configuration.limits.users)
  declare limit: number
}

export class AuthDurationDTO {
  /**
   * Project session length in seconds. Max length: 31536000 seconds.
   */
  @IsInt()
  @Min(0)
  @Max(31536000)
  declare duration: number
}

export class AuthMethodStatusDTO {
  /**
   * Set the status of this auth method.
   */
  @IsBoolean()
  declare status: boolean
}

export class AuthPasswordHistoryDTO {
  /**
   * Set the max number of passwords to store in user history. User can\'t choose a new password that is already stored in the password history list.
   */
  @IsInt()
  @Min(0)
  @Max(configuration.limits.userPasswordHistory)
  declare limit: number
}

export class AuthPasswordDictionaryDTO {
  /**
   * Set whether or not to enable checking user\'s password against most commonly used passwords. Default is false.
   */
  @IsBoolean()
  declare enabled: boolean
}

export class AuthPersonalDataDTO {
  /**
   * Set whether or not to check a password for similarity with personal data. Default is false.
   */
  @IsBoolean()
  declare enabled: boolean
}

export class AuthMaxSessionsDTO {
  /**
   * Set the max number of users allowed in this project.
   */
  @IsInt()
  @Min(0)
  @Max(configuration.limits.userSessionsMax)
  declare limit: number
}

export class MockNumber {
  @IsString()
  @IsPhoneNumber()
  declare phone: string

  @IsString()
  declare otp: string
}

export class AuthMockNumbersDTO {
  /**
   * An array of mock numbers and their corresponding verification codes (OTPs). Each number should be a valid E.164 formatted phone number. Maximum of 10 numbers are allowed.
   */
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MockNumber)
  declare numbers: MockNumber[]
}

export class AuthMembershipPrivacyDTO {
  /**
   * Set to true to show userName to members of a team.
   */
  @IsOptional()
  @IsBoolean()
  userName?: boolean

  /**
   * Set to true to show email to members of a team.
   */
  @IsOptional()
  @IsBoolean()
  userEmail?: boolean

  /**
   * Set to true to show mfa to members of a team.
   */
  @IsOptional()
  @IsBoolean()
  mfa?: boolean
}

// Params

export class AuthMethodParamsDTO extends ProjectParamsDTO {
  /**
   * Auth Method.
   */
  @IsIn(oAuthProvidersList)
  declare method: (typeof oAuthProvidersList)[number]
}
