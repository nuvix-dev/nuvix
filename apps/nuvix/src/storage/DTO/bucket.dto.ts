import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsArray,
  ArrayMaxSize,
  IsIn,
} from 'class-validator';
import {
  APP_LIMIT_ARRAY_PARAMS_SIZE,
  APP_STORAGE_MAX_SIZE,
} from '@nuvix/utils/constants';
import { IsUID } from '@nuvix/core/validators/input.validator';

export class CreateBucketDTO {
  @IsString()
  @IsUID()
  bucketId: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsArray()
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
  @IsString({ each: true })
  @IsOptional()
  permissions: string[] = [];

  @IsBoolean()
  @IsOptional()
  fileSecurity: boolean = false;

  @IsBoolean()
  @IsOptional()
  enabled: boolean = true;

  @IsInt()
  @Min(1)
  @IsOptional()
  maximumFileSize: number = APP_STORAGE_MAX_SIZE;

  @IsArray()
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
  @IsString({ each: true })
  @IsOptional()
  allowedFileExtensions: string[] = [];

  @IsIn(['none', 'gzip', 'zstd'])
  @IsOptional()
  compression: string = 'none';

  @IsBoolean()
  @IsOptional()
  encryption: boolean = false;

  @IsBoolean()
  @IsOptional()
  antivirus: boolean = false;
}

export class UpdateBucketDTO {
  @IsString()
  @IsOptional()
  @MaxLength(128)
  name?: string;

  @IsArray()
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @IsBoolean()
  @IsOptional()
  fileSecurity?: boolean;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  maximumFileSize?: number;

  @IsArray()
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
  @IsString({ each: true })
  @IsOptional()
  allowedFileExtensions?: string[];

  @IsIn(['none', 'gzip', 'zstd'])
  @IsOptional()
  compression?: string;

  @IsBoolean()
  @IsOptional()
  encryption?: boolean;

  @IsBoolean()
  @IsOptional()
  antivirus?: boolean;
}
