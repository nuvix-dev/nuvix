import { OmitType, PartialType } from '@nestjs/swagger'
import { IsOptional, IsArray, IsObject } from 'class-validator'
import { IsCustomID, IsUID } from '@nuvix/core/validators'
import { CollectionParamsDTO } from '../../DTO/collection.dto'

export class CreateDocumentDTO {
  /**
   * ocument ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\'t start with a special char. Max length is 36 chars.
   */
  @IsCustomID()
  declare documentId: string

  /**
   * Document data as JSON object.
   */
  @IsObject()
  declare data: Record<string, any>

  /**
   * An array of permissions strings. By default, only the current user is granted all permissions. [Learn more about permissions](https://docs.nuvix.in/permissions).'
   */
  @IsOptional()
  @IsArray()
  permissions: string[] = []
}

export class UpdateDocumentDTO extends PartialType(
  OmitType(CreateDocumentDTO, ['documentId'] as const),
) {}

// Params
export class DocumentParamsDTO extends CollectionParamsDTO {
  /**
   * Document ID.
   */
  @IsUID()
  declare documentId: string
}
