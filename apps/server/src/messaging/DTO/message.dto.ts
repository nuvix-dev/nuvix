import { PartialType, PickType } from '@nestjs/swagger'
import {
  IsCompoundID,
  IsCustomID,
  IsFutureDate,
  IsUID,
} from '@nuvix/core/validators'
import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsObject,
  IsInt,
  IsDateString,
  IsIn,
  MaxLength,
  Min,
  Validate,
} from 'class-validator'

abstract class CreateMessageDTO {
  /**
   * Message ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\'t start with a special char. Max length is 36 chars.
   */
  @IsCustomID()
  declare messageId: string

  /**
   * List of Topic IDs.
   */
  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  topics?: string[]

  /**
   * List of User IDs.
   */
  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  users?: string[]

  /**
   * List of Targets IDs.
   */
  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  targets?: string[]

  /**
   * Is message a draft
   */
  @IsOptional()
  @IsBoolean()
  draft?: boolean

  /**
   * Scheduled delivery time for message in [ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) format. DateTime value must be in future.
   */
  @IsOptional()
  @IsDateString()
  @IsFutureDate()
  scheduledAt?: string
}

export class CreateEmailMessageDTO extends CreateMessageDTO {
  /**
   * Email Subject.
   */
  @IsString()
  @MaxLength(998)
  declare subject: string

  /**
   * Email Content.
   */
  @IsString()
  @MaxLength(64230)
  declare content: string

  /**
   * Array of target IDs to be added as CC.
   */
  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  cc?: string[]

  /**
   * Array of target IDs to be added as BCC.'
   */
  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  bcc?: string[]

  /**
   * Array of compound ID strings of bucket IDs and file IDs to be attached to the email. They should be formatted as <BUCKET_ID>:<FILE_ID>.
   */
  @IsOptional()
  @IsArray()
  @IsCompoundID({ each: true })
  attachments?: string[]

  /**
   * Is content of type HTML
   */
  @IsOptional()
  @IsBoolean()
  html?: boolean
}

export class CreateSmsMessageDTO extends CreateMessageDTO {
  /**
   * SMS Content.
   */
  @IsString()
  @MaxLength(64230)
  declare content: string
}

export class CreatePushMessageDTO extends CreateMessageDTO {
  /**
   * Title for push notification.
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string

  /**
   * Body for push notification.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64230)
  body?: string

  /**
   * Additional key-value pair data for push notification.
   */
  @IsOptional()
  @IsObject()
  data?: Record<string, any>

  /**
   * Action for push notification.
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  action?: string

  /**
   * Image for push notification. Must be a compound bucket ID to file ID of a jpeg, png, or bmp image in Nuvix Storage. It should be formatted as <BUCKET_ID>:<FILE_ID>.
   */
  @IsOptional()
  @IsString()
  image?: string

  /**
   * Icon for push notification. Available only for Android and Web Platform.
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  icon?: string

  /**
   * Sound for push notification. Available only for Android and iOS Platform.
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  sound?: string

  /**
   * Color for push notification. Available only for Android Platform.
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  color?: string

  /**
   * Tag for push notification. Available only for Android Platform.
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  tag?: string

  /**
   * Badge for push notification. Available only for iOS Platform.
   */
  @IsOptional()
  @IsInt()
  @Min(-1)
  badge?: number

  /**
   * If set to true, the notification will be delivered in the background. Available only for iOS Platform.
   */
  @IsOptional()
  @IsBoolean()
  contentAvailable?: boolean

  /**
   * If set to true, the notification will be marked as critical. This requires the app to have the critical notification entitlement. Available only for iOS Platform.
   */
  @IsOptional()
  @IsBoolean()
  critical?: boolean

  /**
   * Set the notification priority. "normal" will consider device state and may not deliver notifications immediately. "high" will always attempt to immediately deliver the notification.
   */
  @IsOptional()
  @IsIn(['normal', 'high'])
  priority?: 'normal' | 'high' = 'high'
}

export class UpdateEmailMessageDTO extends PartialType(
  PickType(CreateEmailMessageDTO, [
    'topics',
    'users',
    'targets',
    'subject',
    'content',
    'draft',
    'html',
    'cc',
    'bcc',
    'scheduledAt',
    'attachments',
  ] as const),
) {}

export class UpdateSmsMessageDTO extends PartialType(
  PickType(CreateSmsMessageDTO, [
    'topics',
    'users',
    'targets',
    'content',
    'draft',
    'scheduledAt',
  ] as const),
) {}

export class UpdatePushMessageDTO extends PartialType(
  PickType(CreatePushMessageDTO, [
    'topics',
    'users',
    'targets',
    'title',
    'body',
    'data',
    'action',
    'image',
    'icon',
    'sound',
    'color',
    'tag',
    'badge',
    'draft',
    'scheduledAt',
    'contentAvailable',
    'critical',
    'priority',
  ] as const),
) {}

// Params

export class MessageParamsDTO {
  /**
   * Message ID.
   */
  @IsUID()
  declare messageId: string
}
