import { OmitType } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  ArrayMaxSize,
  IsOptional,
  Length,
} from 'class-validator';
import { IsCustomID } from '@nuvix/core/validators/input.validator';
import { configuration } from '@nuvix/utils';

export class CreateFileDTO {
  @IsString()
  @IsCustomID()
  fileId!: string;

  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsOptional()
  permissions?: string[];
}

export class UpdateFileDTO extends OmitType(CreateFileDTO, ['fileId']) {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;
}
