import { OmitType, PartialType } from '@nestjs/mapped-types';
import {
  IsString,
  Length,
  Matches,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  IsOptional,
  IsObject,
} from 'class-validator';
import { APP_LIMIT_ARRAY_PARAMS_SIZE } from 'src/Utils/constants';

export class CreateTeamDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9.-_]{0,35}$/, {
    message:
      'Team ID must be 1-36 characters long, can contain a-z, A-Z, 0-9, period, hyphen, and underscore, and cannot start with a special character.',
  })
  teamId: string;

  @IsString()
  @Length(1, 128, {
    message: 'Team name must be between 1 and 128 characters long.',
  })
  name: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one role must be specified.' })
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE, {
    message: `A maximum of ${APP_LIMIT_ARRAY_PARAMS_SIZE} roles are allowed.`,
  })
  @Length(1, 32, {
    each: true,
    message: 'Each role must be between 1 and 32 characters long.',
  })
  roles: string[];
}

export class UpdateTeamDto extends PartialType(
  OmitType(CreateTeamDto, ['teamId', 'roles']),
) {}

export class UpdateTeamPrefsDto {
  @IsObject()
  prefs?: { [key: string]: any };
}
