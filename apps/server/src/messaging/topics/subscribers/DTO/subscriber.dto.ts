import { IsCustomID, IsUID } from '@nuvix/core/validators'
import { TopicParamsDTO } from '../../DTO/topics.dto'

export class CreateSubscriberDTO {
  /**
   * Subscriber ID. Choose a custom Subscriber ID or a new Subscriber ID.
   */
  @IsCustomID()
  declare subscriberId: string

  /**
   * Target ID. The target ID to link to the specified Topic ID.
   */
  @IsUID()
  declare targetId: string
}

// Params

export class SubscriberParamsDTO extends TopicParamsDTO {
  /**
   * Subscriber ID.
   */
  @IsUID()
  declare subscriberId: string
}
