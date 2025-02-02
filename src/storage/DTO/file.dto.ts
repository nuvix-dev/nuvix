import { OmitType } from '@nestjs/mapped-types';
import {
  IsString,
  IsArray,
  ArrayMaxSize,
  IsIn,
  IsOptional,
  Length,
} from 'class-validator';
import { IsUID } from 'src/core/validators/input.validator';
import { APP_LIMIT_ARRAY_PARAMS_SIZE } from 'src/Utils/constants';

export class CreateFileDTO {
  @IsString()
  @IsUID()
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
