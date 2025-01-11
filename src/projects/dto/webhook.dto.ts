import { IsBoolean, IsString, IsUrl, MaxLength, ValidateNested, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { OmitType, PartialType } from '@nestjs/mapped-types';

export class CreateWebhookDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => String)
  events: string[]

  @IsUrl({ protocols: ['http', 'https'] })
  url: string;

  @IsOptional()
  @IsBoolean()
  security: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  httpUser: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  httpPass: string;
}

export class UpdateWebhookDto extends PartialType(CreateWebhookDto) { }