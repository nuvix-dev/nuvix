import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsString, IsJSON, IsOptional, IsArray } from 'class-validator';
import { IsCustomID } from '@nuvix/core/validators/input.validator';

export class CreateDocumentDTO {
  @IsString()
  @IsCustomID()
  documentId: string;

  data: object;

  @IsOptional()
  @IsArray()
  permissions: string[];
}

export class UpdateDocumentDTO extends PartialType(
  OmitType(CreateDocumentDTO, ['documentId']),
) {}
