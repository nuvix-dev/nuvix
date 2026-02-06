import { OmitType, PartialType } from '@nestjs/swagger'
import { IsCustomID, IsUID } from '@nuvix/core/validators'
import { configuration } from '@nuvix/utils'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class CreateCollectionDTO {
  /**
   * Unique Id. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\'t start with a special char. Max length is 36 chars.
   */
  @IsCustomID()
  declare collectionId: string

  /**
   * Collection name. Max length: 128 chars.
   */
  @IsString()
  @MaxLength(128, { message: 'Collection name. Max length: 128 chars.' })
  declare name: string

  /**
   * An array of permissions strings. By default, no user is granted with any permissions. [Learn more about permissions](https://docs.nuvix.in/permissions).
   */
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsOptional()
  permissions?: string[]

  /**
   * Enables configuring permissions for individual documents. A user needs one of document or collection level permissions to access a document. [Learn more about permissions](https://docs.nuvix.in/permissions).
   */
  @IsOptional()
  @IsBoolean()
  documentSecurity = false

  /**
   * Is collection enabled? When set to \'disabled\', users cannot access the collection but Server SDKs with and API key can still read and write to the collection. No data is lost when this is toggled.
   */
  @IsOptional()
  @IsBoolean()
  enabled = true
}

export class UpdateCollectionDTO extends PartialType(
  OmitType(CreateCollectionDTO, ['collectionId'] as const),
) {
  /**
   * Enables configuring permissions for individual documents. A user needs one of document or collection level permissions to access a document. [Learn more about permissions](https://docs.nuvix.in/permissions).
   */
  @IsOptional()
  @IsBoolean()
  override documentSecurity?: boolean
}

// Params

export class CollectionParamsDTO {
  /**
   * Schema ID. (See [Schemas](https://docs.nuvix.in/schemas)).
   */
  @IsString()
  declare schemaId: string

  /**
   * Collection ID.
   */
  @IsUID()
  declare collectionId: string
}
