import { OmitType, PartialType } from '@nestjs/swagger';
import {
  IsString,
  Length,
  IsArray,
  ArrayMaxSize,
  IsOptional,
  IsObject,
} from 'class-validator';
import { IsCustomID } from '@nuvix/core/validators';
import { configuration } from '@nuvix/utils';

export class CreateTeamDTO {
  @IsCustomID()
  teamId!: string;

  @IsString()
  @Length(1, 128, {
    message: 'Team name must be between 1 and 128 characters long.',
  })
  name!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize, {
    message: `A maximum of ${configuration.limits.arrayParamsSize} roles are allowed.`,
  })
  @Length(1, 32, {
    each: true,
    message: 'Each role must be between 1 and 32 characters long.',
  })
  roles?: string[] = [];
}

export class UpdateTeamDTO extends PartialType(
  OmitType(CreateTeamDTO, ['teamId', 'roles'] as const),
) {}

export class UpdateTeamPrefsDTO {
  @IsObject()
  prefs?: Record<string, any>;
}
