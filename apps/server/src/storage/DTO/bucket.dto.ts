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
import { IsCustomID } from '@nuvix/core/validators/input.validator';
import { configuration } from '@nuvix/utils';

export class CreateBucketDTO {
  @IsString()
  @IsCustomID()
  bucketId!: string;

  @IsString()
  @MaxLength(128)
  name!: string;

  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
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
  maximumFileSize: number = configuration.storage.maxSize;

  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
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
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
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
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
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
