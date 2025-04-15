import { OmitType, PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsUID } from '@nuvix/core/validators/input.validator';

export class CreateCollectionDTO {
  @IsUID()
  collectionId: string;

  @IsString()
  @MaxLength(128, { message: 'Collection name. Max length: 128 chars.' })
  name: string;

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
