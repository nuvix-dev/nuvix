import { IsUID } from '@nuvix/core/validators';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateSMTPProviderDTO {
  @IsString()
  @IsUID()
  providerId: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsString()
  host: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number = 587;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  @IsIn(['none', 'ssl', 'tls'])
  encryption?: string;

  @IsOptional()
  @IsBoolean()
  autoTLS?: boolean = true;

  @IsOptional()
  @IsString()
  mailer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  fromName?: string;

  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  replyToName?: string;

  @IsOptional()
  @IsEmail()
  replyToEmail?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
