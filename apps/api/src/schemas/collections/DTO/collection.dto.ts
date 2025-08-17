import { OmitType, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsCustomID } from '@nuvix/core/validators/input.validator';

export class CreateCollectionDTO {
  @IsCustomID()
  collectionId!: string;

  @IsString()
  @MaxLength(128, { message: 'Collection name. Max length: 128 chars.' })
  name!: string;

  @IsOptional()
  permissions: string[] = [];

  @IsOptional()
  @IsBoolean()
  documentSecurity: boolean = false;

  @IsOptional()
  @IsBoolean()
  enabled: boolean = true;
}

export class UpdateCollectionDTO extends PartialType(
  OmitType(CreateCollectionDTO, ['collectionId']),
) {}
