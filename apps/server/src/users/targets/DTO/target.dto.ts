import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger'
import { IsCustomID, IsUID } from '@nuvix/core/validators'
import { Database } from '@nuvix/db'
import { MessageType } from '@nuvix/utils'
import { IsEnum, IsOptional, IsString, Length } from 'class-validator'
import { UserParamDTO } from '../../DTO/user.dto'

export class CreateTargetDTO {
  /**
   * Target ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\'t start with a special char. Max length is 36 chars.
   */
  @IsCustomID()
  declare targetId: string

  /**
   * The target provider type. Can be one of the following: `email`, `sms` or `push`.
   */
  @IsString()
  @ApiProperty({
    enum: MessageType,
    description:
      'The target provider type. Can be one of the following: `email`, `sms` or `push`.',
  })
  @IsEnum(MessageType)
  declare providerType: string

  /**
   * The target identifier (token, email, phone etc.)
   */
  @IsString()
  @Length(1, Database.LENGTH_KEY)
  declare identifier: string

  /**
   * Provider ID. Message will be sent to this target from the specified provider ID. If no provider ID is set the first setup provider will be used.
   */
  @IsOptional()
  @IsString()
  providerId?: string

  /**
   * Target name. Max length: 128 chars. For example: My Awesome App Galaxy S24.
   */
  @IsString()
  @Length(1, 128)
  declare name: string
}

export class UpdateTargetDTO extends PartialType(
  OmitType(CreateTargetDTO, ['targetId', 'providerType'] as const),
) {}

export class TargetParamDTO extends UserParamDTO {
  /**
   * Target ID.
   */
  @IsUID()
  declare targetId: string
}
