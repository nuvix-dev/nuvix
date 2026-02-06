import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger'
import { IsCustomID, IsUID } from '@nuvix/core/validators'
import { configuration } from '@nuvix/utils'
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator'

export class CreateTeamDTO {
  /**
   * Team ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\'t start with a special char. Max length is 36 chars.
   */
  @IsCustomID()
  declare teamId: string

  /**
   * Team name. Max length: 128 chars.
   */
  @IsString()
  @Length(1, 128, {
    message: 'Team name must be between 1 and 128 characters long.',
  })
  declare name: string

  @ApiPropertyOptional({
    description: `Array of strings. Use this param to set the roles in the team for the user who created it. The default role is **owner**. A role can be any string. Learn more about [roles and permissions](https://docs.nuvix.in/permissions). Maximum of ${configuration.limits.arrayParamsSize} roles are allowed, each 32 characters long.`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize, {
    message: `A maximum of ${configuration.limits.arrayParamsSize} roles are allowed.`,
  })
  @IsString({ each: true })
  @Length(1, 32, {
    each: true,
    message: 'Each role must be between 1 and 32 characters long.',
  })
  roles?: string[] = ['owner']
}

export class UpdateTeamDTO extends PartialType(
  OmitType(CreateTeamDTO, ['teamId', 'roles'] as const),
) {}

export class UpdateTeamPrefsDTO {
  /**
   * Prefs key-value JSON object.
   */
  @IsOptional()
  @IsObject()
  prefs?: Record<string, any>
}

// Params

export class TeamsParamDTO {
  /**
   * Team ID.
   */
  @IsUID()
  declare teamId: string
}
