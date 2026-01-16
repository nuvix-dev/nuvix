import {
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  IsUrl,
  IsOptional,
} from 'class-validator'
import { IsUID } from '@nuvix/core/validators'
import { configuration } from '@nuvix/utils'
import { TeamsParamDTO } from '../../DTO/team.dto'

export class CreateMembershipDTO {
  /**
   * Email of the new team member.
   */
  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  email?: string

  /**
   * ID of the user to be added to a team.
   */
  @IsOptional()
  @IsUID()
  userId?: string

  /**
   * Phone number. Format this number with a leading \'+\' and a country code, e.g., +16175551212.
   */
  @IsOptional()
  @IsPhoneNumber()
  @IsNotEmpty()
  phone?: string

  /**
   * Array of strings. Use this param to set the user roles in the team. A role can be any string. Learn more about [roles and permissions](https://docs.nuvix.in/permissions).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsString({ each: true })
  roles: string[] = []

  /**
   * URL to redirect the user back to your app from the invitation email. This parameter is not required when an API key is supplied. Only URLs from hostnames in your project platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.
   */
  @IsOptional()
  @IsUrl()
  @IsNotEmpty()
  url?: string

  /**
   * Name of the new team member.
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @IsNotEmpty()
  name?: string
}

export class UpdateMembershipDTO {
  /**
   * An array of strings. Use this param to set the user\'s roles in the team. A role can be any string. Learn more about [roles and permissions](https://docs.nuvix.in/permissions).
   */
  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsString({ each: true })
  declare roles: string[]
}

export class UpdateMembershipStatusDTO {
  /**
   * User ID.
   */
  @IsNotEmpty()
  @IsString()
  declare userId: string

  /**
   * Secret key.
   */
  @IsNotEmpty()
  @MaxLength(256)
  declare secret: string
}

// Params

export class MembershipParamDTO extends TeamsParamDTO {
  /**
   * Membership ID.
   */
  @IsUID()
  declare membershipId: string
}
