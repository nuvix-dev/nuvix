import {
  IsString,
  IsArray,
  ArrayMaxSize,
  IsIn,
  IsOptional,
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
