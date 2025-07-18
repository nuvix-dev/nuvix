import { OmitType } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  ArrayMaxSize,
  IsIn,
  IsOptional,
  Length,
} from 'class-validator';
import { IsCustomID } from '@nuvix/core/validators/input.validator';
import { APP_LIMIT_ARRAY_PARAMS_SIZE } from '@nuvix/utils/constants';

export class CreateFileDTO {
  @IsString()
  @IsCustomID()
  fileId: string;

  @IsArray()
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
  @IsOptional()
  permissions?: string[];
}

export class UpdateFileDTO extends OmitType(CreateFileDTO, ['fileId']) {
  @IsString()
  @Length(1, 255)
  @IsOptional()
  name: string;
}
