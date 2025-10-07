import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger'
import { PlatformType } from '@nuvix/core/config'
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { ProjectParamsDTO } from '../../DTO/create-project.dto'
import { IsUID } from '@nuvix/core/validators'

export class CreatePlatformDTO {
  /**
   * Platform name.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  declare name: string

  /**
   * Platform type.
   */
  @ApiProperty({ enum: PlatformType })
  @IsEnum(PlatformType)
  declare type: string

  /**
   * Package name for Android or bundle ID for iOS or macOS.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  key?: string

  /**
   * App store or Google Play store ID.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  store?: string

  /**
   * Platform client hostname.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  hostname?: string
}

export class UpdatePlatformDTO extends PartialType(
  OmitType(CreatePlatformDTO, ['type'] as const),
) {}

// Params

export class PlatformParamsDTO extends ProjectParamsDTO {
  /**
   * Platform ID.
   */
  @IsUID()
  declare platformId: string
}
