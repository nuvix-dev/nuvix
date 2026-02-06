import { PartialType } from '@nestjs/swagger'
import { IsUID } from '@nuvix/core/validators'
import { configuration } from '@nuvix/utils'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator'
import { ProjectParamsDTO } from '../../DTO/create-project.dto'

export class CreateWebhookDTO {
  /**
   * Webhook name. Max length: 128 chars.
   */
  @IsString()
  @MaxLength(128)
  declare name: string

  /**
   * Enable or disable a webhook.
   */
  @IsBoolean()
  declare enabled: boolean

  /**
   * Events list
   */
  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsString({ each: true })
  declare events: string[]

  /**
   * Webhook URL.
   */
  @IsUrl({ protocols: ['http', 'https'] })
  declare url: string

  /**
   * Certificate verification, false for disabled or true for enabled.
   */
  @IsOptional()
  @IsBoolean()
  declare security?: boolean

  /**
   * Webhook HTTP user. Max length: 256 chars.
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  httpUser?: string

  /**
   * Webhook HTTP password. Max length: 256 chars.
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  httpPass?: string
}

export class UpdateWebhookDTO extends PartialType(CreateWebhookDTO) {}

// Params

export class WebhookParamsDTO extends ProjectParamsDTO {
  /**
   * Webhook unique ID.
   */
  @IsUID()
  declare webhookId: string
}
