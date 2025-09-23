import { PartialType } from '@nestjs/swagger';
import { OmitType } from '@nestjs/swagger';
import { IsCustomID } from '@nuvix/core/validators';
import { configuration } from '@nuvix/utils';
import {
  IsString,
  IsArray,
  IsOptional,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';

export class CreateTopicDTO {
  @IsCustomID()
  topicId!: string;

  @IsString()
  @MaxLength(128)
  name!: string;

  // TODO: Add validation for subscribe
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @MaxLength(64, { each: true })
  subscribe?: string[];
}

export class UpdateTopicDTO extends PartialType(
  OmitType(CreateTopicDTO, ['topicId']),
) {}
