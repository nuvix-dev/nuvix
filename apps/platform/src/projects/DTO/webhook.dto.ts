import {
  IsBoolean,
  IsString,
  IsUrl,
  MaxLength,
  IsArray,
  IsOptional,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateWebhookDTO {
  @IsString()
  @MaxLength(128)
  name!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @IsUrl({ protocols: ['http', 'https'] })
  url!: string;

  @IsOptional()
  @IsBoolean()
  security!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  httpUser!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  httpPass!: string;
}

export class UpdateWebhookDTO extends PartialType(CreateWebhookDTO) {}
