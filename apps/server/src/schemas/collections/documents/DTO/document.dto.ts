import { OmitType, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';
import { IsCustomID } from '@nuvix/core/validators/input.validator';

export class CreateDocumentDTO {
  @IsString()
  @IsCustomID()
  documentId!: string;

  @IsObject()
  data!: Record<string, any>;

  @IsOptional()
  @IsArray()
  permissions: string[] = [];
}

export class UpdateDocumentDTO extends PartialType(
  OmitType(CreateDocumentDTO, ['documentId'] as const),
) {}
