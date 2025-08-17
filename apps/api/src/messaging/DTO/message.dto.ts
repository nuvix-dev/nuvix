import { PartialType, PickType } from '@nestjs/swagger';
import { IsCustomID, IsUID } from '@nuvix/core/validators';
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
} from 'class-validator';

export class CreateEmailMessageDTO {
  @IsCustomID()
  messageId!: string;

  @IsString()
  @MaxLength(998)
  subject!: string;

  @IsString()
  @MaxLength(64230)
  content!: string;

  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  topics?: string[];

  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  users?: string[];

  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  targets?: string[];

  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  cc?: string[];

  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  bcc?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true }) // TODO: CompoundID
  attachments?: string[];

  @IsOptional()
  @IsBoolean()
  draft?: boolean;

  @IsOptional()
  @IsBoolean()
  html?: boolean;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string; // TODO: Future Date validation
}

export class CreateSmsMessageDTO {
  @IsCustomID()
  messageId!: string;

  @IsString()
  @MaxLength(64230)
  content!: string;

  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  topics?: string[];

  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  users?: string[];

  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  targets?: string[];

  @IsOptional()
  @IsBoolean()
  draft?: boolean;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class CreatePushMessageDTO {
  @IsCustomID()
  messageId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64230)
  body?: string;

  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  topics?: string[];

  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  users?: string[];

  @IsOptional()
  @IsArray()
  @IsUID({ each: true })
  targets?: string[];

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  action?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  sound?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  tag?: string;

  @IsOptional()
  @IsInt()
  @Min(-1)
  badge?: number;

  @IsOptional()
  @IsBoolean()
  draft?: boolean;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsBoolean()
  contentAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  critical?: boolean;

  @IsOptional()
  @IsIn(['normal', 'high'])
  priority?: 'normal' | 'high';
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
  ]),
) {}

export class UpdateSmsMessageDTO extends PartialType(
  PickType(CreateSmsMessageDTO, [
    'topics',
    'users',
    'targets',
    'content',
    'draft',
    'scheduledAt',
  ]),
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
  ]),
) {}
