import { OmitType, PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { IsUID } from '@nuvix/core/validators/input.validator';

export class CreateDatabaseDTO {
  @IsUID()
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
