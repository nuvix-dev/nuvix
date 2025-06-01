import { OmitType, PartialType } from '@nestjs/mapped-types';
import {
  IsString,
  Length,
  IsArray,
  ArrayMaxSize,
  IsOptional,
  IsObject,
} from 'class-validator';
import { IsCustomID } from '@nuvix/core/validators';
import { APP_LIMIT_ARRAY_PARAMS_SIZE } from '@nuvix/utils/constants';

export class CreateTeamDTO {
  @IsCustomID()
  teamId: string;

  @IsString()
  @Length(1, 128, {
    message: 'Team name must be between 1 and 128 characters long.',
  })
  name: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE, {
    message: `A maximum of ${APP_LIMIT_ARRAY_PARAMS_SIZE} roles are allowed.`,
  })
  @Length(1, 32, {
    each: true,
    message: 'Each role must be between 1 and 32 characters long.',
  })
  roles: string[] = [];
}

export class UpdateTeamDTO extends PartialType(
  OmitType(CreateTeamDTO, ['teamId', 'roles']),
) {}

export class UpdateTeamPrefsDTO {
  @IsObject()
  prefs?: { [key: string]: any };
}
