import { OmitType, PartialType } from '@nestjs/swagger'
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator'
import { CreateProviderDTO } from './base.dto'

export class CreateSendgridProviderDTO extends CreateProviderDTO {
  /**
   * Sendgrid API key.
   */
  @IsString()
  declare apiKey: string

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

export class UpdateSendgridProviderDTO extends PartialType(
  OmitType(CreateSendgridProviderDTO, ['providerId'] as const),
) {}
