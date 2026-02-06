import { OmitType } from '@nestjs/swagger'
import { IsCustomID, IsUID } from '@nuvix/core/validators'
import { configuration } from '@nuvix/utils'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator'
import { BucketParamsDTO } from '../../DTO/bucket.dto'

export class CreateFileDTO {
  @IsString()
  @IsCustomID()
  declare fileId: string

  /**
   * An array of permission strings. By default, only the current user is granted all permissions. [Learn more about permissions](https://docs.nuvix.in/permissions).
   */
  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsOptional()
  permissions?: string[]
}

export class UpdateFileDTO extends OmitType(CreateFileDTO, [
  'fileId',
] as const) {
  /**
   * A name for the file (1-255 characters).
   */
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string
}

// Params

export class FileParamsDTO extends BucketParamsDTO {
  /**
   * The file ID.
   */
  @IsUID()
  declare fileId: string
}

// Query

export class PreviewFileQueryDTO {
  /**
   * Resize preview image width, integer between 0 and 4000.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(4000)
  width?: number

  /**
   * Resize preview image height, integer between 0 and 4000.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(4000)
  height?: number

  /**
   * Image crop gravity.
   */
  @IsOptional()
  @IsString()
  @IsIn([
    'center',
    'top-left',
    'top',
    'top-right',
    'left',
    'right',
    'bottom-left',
    'bottom',
    'bottom-right',
  ])
  gravity?: string

  /**
   * Preview image quality, integer between 0 and 100.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  quality?: number

  /**
   * Preview image border in pixels, integer between 0 and 100.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  borderWidth?: number

  /**
   * Preview image border color, valid HEX without # prefix.
   */
  @IsOptional()
  @IsString()
  borderColor?: string

  /**
   * Preview image border radius in pixels, integer between 0 and 4000.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(4000)
  borderRadius?: number

  /**
   * Preview image opacity, number between 0 and 1.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  opacity?: number

  /**
   * Preview image rotation in degrees, integer between -360 and 360.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-360)
  @Max(360)
  rotation?: number

  /**
   * Preview image background color, valid HEX without # prefix.
   */
  @IsOptional()
  @IsString()
  background?: string

  /**
   * Output format type (jpeg, jpg, png, gif, webp).
   */
  @IsOptional()
  @IsString()
  @IsIn(['jpeg', 'jpg', 'png', 'gif', 'webp'])
  output?: string
}
