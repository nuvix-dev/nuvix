import { OmitType, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { IsCustomID } from '@nuvix/core/validators/input.validator';

export class CreateDatabaseDTO {
  @IsCustomID()
  databaseId: string;

  @IsString()
  @Length(1, 128, {
    message: 'Database name must be between 1 and 128 characters.',
  })
  name: string;

  @IsOptional()
  @IsBoolean()
  enabled: boolean;
}

export class UpdateDatabaseDTO extends PartialType(
  OmitType(CreateDatabaseDTO, ['databaseId']),
) {}
