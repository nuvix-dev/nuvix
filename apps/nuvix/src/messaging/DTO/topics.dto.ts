import { IsUID } from '@nuvix/core/validators';
import { APP_LIMIT_ARRAY_PARAMS_SIZE } from '@nuvix/utils/constants';
import {
  IsString,
  IsArray,
  IsOptional,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';

export class CreateTopicDTO {
  @IsUID()
  topicId: string;

  @IsString()
  @MaxLength(128)
  name: string;

  // TODO: Add validation for subscribe
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
  @MaxLength(64, { each: true })
  subscribe?: string[];
}
