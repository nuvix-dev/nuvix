import { OmitType, PartialType, PickType } from '@nestjs/swagger';
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
import { APP_DATABASE_ATTRIBUTE_STRING_MAX_LENGTH } from '@nuvix/utils/constants';

export class CreateStringAttributeDTO {
  @IsString()
  @IsKey()
  key: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(APP_DATABASE_ATTRIBUTE_STRING_MAX_LENGTH)
  size?: number = null;

  @IsOptional()
  @IsBoolean()
  required?: boolean = null;

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
  ['encrypt', 'size'],
) {}

export class CreateEnumAttributeDTO extends OmitType(CreateStringAttributeDTO, [
  'encrypt',
  'size',
  'default',
]) {
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
]) {}

export class CreateURLAttributeDTO extends OmitType(CreateStringAttributeDTO, [
  'encrypt',
  'size',
]) {}

export class CreateIntegerAttributeDTO extends OmitType(
  CreateStringAttributeDTO,
  ['size', 'encrypt', 'default'],
) {
  @IsOptional()
  @IsInt()
  min?: number = null;

  @IsOptional()
  @IsInt()
  max?: number = null;

  @IsOptional()
  @IsInt()
  default?: number = null;
}

export class CreateFloatAttributeDTO extends CreateIntegerAttributeDTO {}

export class CreateBooleanAttributeDTO extends OmitType(
  CreateStringAttributeDTO,
  ['size', 'encrypt', 'default'],
) {
  @IsOptional()
  @IsBoolean()
  default?: boolean = null;
}

export class CreateDatetimeAttributeDTO extends OmitType(
  CreateStringAttributeDTO,
  ['size', 'encrypt'],
) {}

export class CreateRelationAttributeDTO {
  @IsString()
  @IsKey()
  relatedCollectionId: string;

  @IsString()
  @IsKey()
  type: string;

  @IsOptional()
  @IsBoolean()
  twoWay?: boolean = false;

  @IsString()
  @IsKey()
  key: string;

  @IsOptional()
  @IsString()
  @IsKey()
  twoWayKey?: string = null;

  @IsString()
  @IsKey()
  onDelete: string;
}

// Update DTOs

export class UpdateStringAttributeDTO extends PartialType(
  OmitType(CreateStringAttributeDTO, ['array', 'encrypt', 'key']),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string = null;
}

export class UpdateEmailAttributeDTO extends UpdateStringAttributeDTO {}

export class UpdateEnumAttributeDTO extends PartialType(
  PickType(CreateEnumAttributeDTO, ['required', 'default', 'elements']),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string = null;
}

export class UpdateIpAttributeDTO extends PartialType(
  PickType(CreateIpAttributeDTO, ['required', 'default']),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string = null;
}

export class UpdateURLAttributeDTO extends PartialType(
  PickType(CreateURLAttributeDTO, ['required', 'default']),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string = null;
}

export class UpdateIntegerAttributeDTO extends PartialType(
  PickType(CreateIntegerAttributeDTO, ['required', 'default', 'min', 'max']),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string = null;
}

export class UpdateFloatAttributeDTO extends PartialType(
  PickType(CreateFloatAttributeDTO, ['required', 'default', 'min', 'max']),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string = null;
}

export class UpdateBooleanAttributeDTO extends PartialType(
  PickType(CreateBooleanAttributeDTO, ['required', 'default']),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string = null;
}

export class UpdateDatetimeAttributeDTO extends PartialType(
  PickType(CreateDatetimeAttributeDTO, ['required', 'default']),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string = null;
}

export class UpdateRelationAttributeDTO extends PartialType(
  PickType(CreateRelationAttributeDTO, ['onDelete']),
) {
  @IsOptional()
  @IsString()
  @IsKey()
  newKey?: string = null;
}
