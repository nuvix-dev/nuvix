import { PartialType } from '@nestjs/swagger'
import { OmitType } from '@nestjs/swagger'
import { IsCustomID, IsUID } from '@nuvix/core/validators'
import { configuration } from '@nuvix/utils'
import {
  IsString,
  IsArray,
  IsOptional,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator'

export class CreateTopicDTO {
  /**
   * Topic ID. Choose a custom Topic ID or a new Topic ID.
   */
  @IsCustomID()
  declare topicId: string

  /**
   * Topic Name.
   */
  @IsString()
  @MaxLength(128)
  declare name: string

  /**
   * An array of role strings with subscribe permission. By default all users are granted with any subscribe permission. [learn more about roles](https://docs.nuvix.in/permissions#permission-roles).
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @MaxLength(64, { each: true })
  subscribe?: string[] // TODO: Add validation for subscribe
}

export class UpdateTopicDTO extends PartialType(
  OmitType(CreateTopicDTO, ['topicId'] as const),
) {}

// Params

export class TopicParamsDTO {
  /**
   * Topic ID.
   */
  @IsUID()
  declare topicId: string
}
