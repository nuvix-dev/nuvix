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
  Max,
} from 'class-validator'
import { IsCustomID, IsUID } from '@nuvix/core/validators'
import { configuration } from '@nuvix/utils'
import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger'

export class CreateBucketDTO {
  /**
   * Unique Id. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\'t start with a special char. Max length is 36 chars.
   */
  @IsString()
  @IsCustomID()
  declare bucketId: string

  /**
   * Bucket name
   */
  @IsString()
  @MaxLength(128)
  declare name: string

  /**
   * An array of permission strings. By default, no user is granted with any permissions. [Learn more about permissions](https://docs.nuvix.in/permissions).
   */
  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsString({ each: true })
  @IsOptional()
  permissions: string[] = []

  /**
   * Enables configuring permissions for individual file. A user needs one of file or bucket level permissions to access a file. [Learn more about permissions](https://docs.nuvix.in/permissions).
   */
  @IsBoolean()
  @IsOptional()
  fileSecurity: boolean = false

  /**
   * Is bucket enabled? When set to \'disabled\', users cannot access the files in this bucket but Server SDKs with and API key can still access the bucket. No files are lost when this is toggled.
   */
  @IsBoolean()
  @IsOptional()
  enabled: boolean = true

  /**
   * Maximum file size allowed in bytes.
   */
  @IsInt()
  @Min(1)
  @Max(configuration.storage.limit)
  @IsOptional()
  maximumFileSize: number = configuration.storage.maxSize

  /**
   * Allowed file extensions.
   */
  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsString({ each: true })
  @IsOptional()
  allowedFileExtensions: string[] = []

  /**
   * Compression algorithm choosen for compression.
   */
  @ApiPropertyOptional({
    description: 'Compression algorithm choosen for compression.',
    enum: ['none', 'gzip', 'zstd'],
  })
  @IsIn(['none', 'gzip', 'zstd'])
  @IsOptional()
  compression: string = 'none'

  /**
   * Is encryption enabled?
   */
  @IsBoolean()
  @IsOptional()
  encryption: boolean = false

  /**
   * Is virus scanning enabled?
   */
  @IsBoolean()
  @IsOptional()
  antivirus: boolean = false
}

export class UpdateBucketDTO extends PartialType(
  OmitType(CreateBucketDTO, ['bucketId'] as const),
) {}

// Params

export class BucketParamsDTO {
  /**
   * Bucket ID.
   */
  @IsUID()
  declare bucketId: string
}

// Query

export class UsageQueryDTO {
  /**
   * Date range.
   */
  @IsOptional()
  @ApiPropertyOptional({
    enum: ['24h', '30d', '90d'],
  })
  @IsIn(['24h', '30d', '90d'])
  range?: string = '30d'
}
