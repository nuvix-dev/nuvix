import {
  OmitType,
  PartialType,
  PickType,
  IntersectionType,
} from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { IsKey } from '@nuvix/core/validators/input.validator';
import { APP_DATABASE_ATTRIBUTE_STRING_MAX_LENGTH } from '@nuvix/utils';

export class CreateStringAttributeDTO {
  @IsString()
  @IsKey()
  key!: string;

  @IsInt()
  @Min(1)
  @Max(APP_DATABASE_ATTRIBUTE_STRING_MAX_LENGTH)
  size: number = 0;

  @IsOptional()
  @IsBoolean()
  required?: boolean = false;

  @IsOptional()
  @IsString()
  default?: string | null = null;

  @IsOptional()
  @IsBoolean()
  array?: boolean = false;

  @IsOptional()
  @IsBoolean()
  encrypt?: boolean = false;
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
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(1, 1024, { each: true })
  elements?: string[] = [];

  @IsOptional()
  default?: string | any = null;
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
  @IsOptional()
  @IsInt()
  min?: number;

  @IsOptional()
  @IsInt()
  max?: number;

  @IsOptional()
  @IsInt()
  default?: number;
}

export class CreateFloatAttributeDTO extends CreateIntegerAttributeDTO {}

export class CreateBooleanAttributeDTO extends OmitType(
  CreateStringAttributeDTO,
  ['size', 'encrypt', 'default'] as const,
) {
  @IsOptional()
  @IsBoolean()
  default?: boolean = false;
}

export class CreateDatetimeAttributeDTO extends OmitType(
  CreateStringAttributeDTO,
  ['size', 'encrypt'] as const,
) {}

export class CreateRelationAttributeDTO {
  @IsString()
  @IsKey()
  relatedCollectionId!: string;

  @IsString()
  @IsKey()
  type!: string;

  @IsOptional()
  @IsBoolean()
  twoWay?: boolean = false;

  @IsString()
  @IsKey()
  key!: string;

  @IsOptional()
  @IsString()
  @IsKey()
  twoWayKey?: string;

  @IsString()
  @IsKey()
  onDelete!: string;
}

// Update DTOs

export class UpdateStringAttributeDTO extends PartialType(
  OmitType(CreateStringAttributeDTO, ['array', 'encrypt', 'key'] as const),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string;
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
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string;
}

export class UpdateIpAttributeDTO extends PartialType(
  PickType(CreateIpAttributeDTO, ['required', 'default'] as const),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string;
}

export class UpdateURLAttributeDTO extends PartialType(
  PickType(CreateURLAttributeDTO, ['required', 'default'] as const),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string;
}

export class UpdateIntegerAttributeDTO extends PartialType(
  PickType(CreateIntegerAttributeDTO, [
    'required',
    'default',
    'min',
    'max',
  ] as const),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string;
}

export class UpdateFloatAttributeDTO extends PartialType(
  PickType(CreateFloatAttributeDTO, [
    'required',
    'default',
    'min',
    'max',
  ] as const),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string;
}

export class UpdateBooleanAttributeDTO extends PartialType(
  PickType(CreateBooleanAttributeDTO, ['required', 'default'] as const),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string;
}

export class UpdateDatetimeAttributeDTO extends PartialType(
  PickType(CreateDatetimeAttributeDTO, ['required', 'default'] as const),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string;
}

export class UpdateRelationAttributeDTO extends PartialType(
  PickType(CreateRelationAttributeDTO, ['onDelete'] as const),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string;
}
