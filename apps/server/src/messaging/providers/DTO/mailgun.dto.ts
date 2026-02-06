import { OmitType, PartialType } from '@nestjs/swagger'
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'
import { CreateProviderDTO } from './base.dto'

export class CreateMailgunProviderDTO extends CreateProviderDTO {
  /**
   * Mailgun API Key.
   */
  @IsString()
  @IsOptional()
  apiKey?: string

  /**
   * Mailgun Domain.
   */
  @IsString()
  @IsOptional()
  domain?: string

  /**
   * Set as EU region.
   */
  @IsBoolean()
  @IsOptional()
  isEuRegion?: boolean

  /**
   * Sender Name.
   */
  @IsString()
  @MaxLength(128)
  @IsOptional()
  fromName?: string

  /**
   * Sender email address.
   */
  @IsEmail()
  @IsOptional()
  fromEmail?: string

  /**
   * Name set in the reply to field for the mail. Default value is sender name. Reply to name must have reply to email as well.
   */
  @IsString()
  @MaxLength(128)
  @IsOptional()
  replyToName?: string

  /**
   * Email set in the reply to field for the mail. Default value is sender email. Reply to email must have reply to name as well.
   */
  @IsEmail()
  @IsOptional()
  replyToEmail?: string
}

export class UpdateMailgunProviderDTO extends PartialType(
  OmitType(CreateMailgunProviderDTO, ['providerId'] as const),
) {}
