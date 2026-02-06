import { PartialType } from '@nestjs/swagger'
import { IsUID } from '@nuvix/core/validators'
import { configuration } from '@nuvix/utils'
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { ProjectParamsDTO } from '../../DTO/create-project.dto'

export class CreateKeyDTO {
  /**
   * Key name. Max length: 128 chars.
   */
  @IsString()
  @MaxLength(128)
  @MinLength(1)
  declare name: string

  /**
   * Key scopes list.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  declare scopes?: string[]

  /**
   * Expiration time in [ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) format. If not set, the key won't expire.
   */
  @IsOptional()
  @IsDateString()
  expire?: string
}

export class UpdateKeyDTO extends PartialType(CreateKeyDTO) {}

// Params

export class KeyParamsDTO extends ProjectParamsDTO {
  /**
   * Key ID.
   */
  @IsUID()
  declare keyId: string
}
