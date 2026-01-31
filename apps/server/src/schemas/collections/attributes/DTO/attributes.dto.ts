import {
  OmitType,
  PartialType,
  PickType,
  IntersectionType,
  ApiProperty,
} from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator'
import { IsKey, IsUID } from '@nuvix/core/validators'
import {
  APP_DATABASE_ATTRIBUTE_STRING_MAX_LENGTH,
  configuration,
} from '@nuvix/utils'
import { OnDelete, RelationType } from '@nuvix/db'
import { CollectionParamsDTO } from '../../DTO/collection.dto'

export class CreateStringAttributeDTO {
  /**
   * Attribute Key.
   */
  @IsString()
  @IsKey()
  declare key: string

  /**
   * Attribute size for text attributes, in number of characters
   */
  @IsInt()
  @Min(1)
  @Max(APP_DATABASE_ATTRIBUTE_STRING_MAX_LENGTH)
  size: number = 0

  /**
   * Is attribute required?
   */
  @IsOptional()
  @IsBoolean()
  required?: boolean = false

  /**
   * Default value for attribute when not provided. Cannot be set when attribute is required.
   */
  @IsOptional()
  @IsString()
  default?: string | null = null

  /**
   * Is attribute an array?
   */
  @IsOptional()
  @IsBoolean()
  array?: boolean = false

  /**
   * Toggle encryption for the attribute. Encryption enhances security by not storing any plain text values in the database. However, encrypted attributes cannot be queried.
   */
  @IsOptional()
  @IsBoolean()
  encrypt?: boolean = false
}

export class CreateEmailAttributeDTO extends OmitType(
  CreateStringAttributeDTO,
  ['encrypt', 'size'] as const,
) {}

export class CreateEnumAttributeDTO extends OmitType(CreateStringAttributeDTO, [
  'encrypt',
  'size',
  'default',
] as const) {
  /**
   * Array of elements in enumerated type. Uses length of longest element to determine size.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(1, 1024, { each: true })
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  elements?: string[] = []

  /**
   * Default value for attribute when not provided. Cannot be set when attribute is required.
   */
  @IsOptional()
  default?: string | any = null
}

export class CreateIpAttributeDTO extends OmitType(CreateStringAttributeDTO, [
  'encrypt',
  'size',
] as const) {}

export class CreateURLAttributeDTO extends OmitType(CreateStringAttributeDTO, [
  'encrypt',
  'size',
] as const) {}

export class CreateIntegerAttributeDTO extends OmitType(
  CreateStringAttributeDTO,
  ['size', 'encrypt', 'default'] as const,
) {
  /**
   * Minimum value to enforce on new documents
   */
  @IsOptional()
  @IsInt()
  min?: number

  /**
   * Maximum value to enforce on new documents
   */
  @IsOptional()
  @IsInt()
  max?: number

  /**
   * Default value for attribute when not provided. Cannot be set when attribute is required.
   */
  @IsOptional()
  @IsInt()
  default?: number
}

export class CreateFloatAttributeDTO extends CreateIntegerAttributeDTO {}

export class CreateBooleanAttributeDTO extends OmitType(
  CreateStringAttributeDTO,
  ['size', 'encrypt', 'default'] as const,
) {
  /**
   * Default value for attribute when not provided. Cannot be set when attribute is required.
   */
  @IsOptional()
  @IsBoolean()
  default?: boolean
}

export class CreateDatetimeAttributeDTO extends OmitType(
  CreateStringAttributeDTO,
  ['size', 'encrypt'] as const,
) {}

export class CreateRelationAttributeDTO {
  /**
   * Related Collection ID.
   */
  @IsUID()
  declare relatedCollectionId: string

  /**
   * Relation type
   */
  @ApiProperty({
    enum: RelationType,
    description: 'Relation type',
  })
  @IsEnum(RelationType)
  declare type: RelationType

  /**
   * Is Two Way?
   */
  @IsOptional()
  @IsBoolean()
  twoWay?: boolean = false

  /**
   * Attribute Key.
   */
  @IsString()
  @IsKey()
  declare key: string

  /**
   * Two Way Attribute Key.
   */
  @IsOptional()
  @IsString()
  @IsKey()
  twoWayKey?: string

  /**
   * Constraints option
   */
  @ApiProperty({
    enum: OnDelete,
    description: 'Constraints option',
  })
  @IsEnum(OnDelete)
  declare onDelete: OnDelete
}

// Update DTOs

export class UpdateStringAttributeDTO extends PartialType(
  OmitType(CreateStringAttributeDTO, ['array', 'encrypt', 'key'] as const),
) {
  /**
   * New attribute key.
   */
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string
}

export class UpdateEmailAttributeDTO extends IntersectionType(
  UpdateStringAttributeDTO,
) {}

export class UpdateEnumAttributeDTO extends PartialType(
  PickType(CreateEnumAttributeDTO, [
    'required',
    'default',
    'elements',
  ] as const),
) {
  /**
   * New attribute key.
   */
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string
}

export class UpdateIpAttributeDTO extends PartialType(
  PickType(CreateIpAttributeDTO, ['required', 'default'] as const),
) {
  /**
   * New attribute key.
   */
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string
}

export class UpdateURLAttributeDTO extends PartialType(
  PickType(CreateURLAttributeDTO, ['required', 'default'] as const),
) {
  /**
   * New attribute key.
   */
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string
}

export class UpdateIntegerAttributeDTO extends PartialType(
  PickType(CreateIntegerAttributeDTO, [
    'required',
    'default',
    'min',
    'max',
  ] as const),
) {
  /**
   * New attribute key.
   */
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string
}

export class UpdateFloatAttributeDTO extends PartialType(
  PickType(CreateFloatAttributeDTO, [
    'required',
    'default',
    'min',
    'max',
  ] as const),
) {
  /**
   * New attribute key.
   */
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string
}

export class UpdateBooleanAttributeDTO extends PartialType(
  PickType(CreateBooleanAttributeDTO, ['required', 'default'] as const),
) {
  /**
   * New attribute key.
   */
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string
}

export class UpdateDatetimeAttributeDTO extends PartialType(
  PickType(CreateDatetimeAttributeDTO, ['required', 'default'] as const),
) {
  /**
   * New attribute key.
   */
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string
}

export class UpdateRelationAttributeDTO extends PartialType(
  PickType(CreateRelationAttributeDTO, ['onDelete'] as const),
) {
  /**
   * New attribute key.
   */
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string
}

// Params

export class AttributeParamsDTO extends CollectionParamsDTO {
  /**
   * Attribute Key.
   */
  @IsKey()
  declare key: string
}
