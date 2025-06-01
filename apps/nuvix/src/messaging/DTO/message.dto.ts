import { IsCustomID, IsUID } from '@nuvix/core/validators';
import { IsString, IsOptional, IsArray, IsBoolean, IsObject, IsInt, IsDateString, IsIn, MaxLength, Min } from 'class-validator';

export class CreateEmailMessageDTO {
    @IsCustomID()
    messageId: string;

    @IsString()
    @MaxLength(998)
    subject: string;

    @IsString()
    @MaxLength(64230)
    content: string;

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
    scheduledAt?: string;
}

export class CreateSmsMessageDTO {
    @IsCustomID()
    messageId: string;

    @IsString()
    @MaxLength(64230)
    content: string;

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
    messageId: string;

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