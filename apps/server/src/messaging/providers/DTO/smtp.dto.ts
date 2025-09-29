import { PartialType, OmitType } from '@nestjs/swagger'
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
} from 'class-validator'
import { CreateProviderDTO } from './base.dto'

export class CreateSMTPProviderDTO extends CreateProviderDTO {
  /**
   * SMTP hosts. Either a single hostname or multiple semicolon-delimited hostnames. You can also specify a different port for each host such as `smtp1.example.com:25;smtp2.example.com`. You can also specify encryption type, for example: `tls://smtp1.example.com:587;ssl://smtp2.example.com:465"`. Hosts will be tried in order.
   */
  @IsString()
  declare host: string

  /**
   * The default SMTP server port.
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number = 587

  /**
   * Authentication username.
   */
  @IsOptional()
  @IsString()
  username?: string

  /**
   * Authentication password.
   */
  @IsOptional()
  @IsString()
  password?: string

  /**
   * Encryption type. Can be omitted, 'ssl' or 'tls'
   */
  @IsOptional()
  @IsString()
  @IsIn(['none', 'ssl', 'tls'])
  encryption?: string = 'none'

  /**
   * Enable SMTP AutoTLS feature.
   */
  @IsOptional()
  @IsBoolean()
  autoTLS?: boolean = true

  /**
   * The value to use for the X-Mailer header.
   */
  @IsOptional()
  @IsString()
  mailer?: string

  /**
   * Sender Name.
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  fromName?: string

  /**
   * Sender email address.
   */
  @IsOptional()
  @IsEmail()
  fromEmail?: string

  /**
   * Name set in the reply to field for the mail. Default value is sender name.
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  replyToName?: string

  /**
   * Email set in the reply to field for the mail. Default value is sender email.
   */
  @IsOptional()
  @IsEmail()
  replyToEmail?: string
}

export class UpdateSMTPProviderDTO extends PartialType(
  OmitType(CreateSMTPProviderDTO, ['providerId'] as const),
) {}
