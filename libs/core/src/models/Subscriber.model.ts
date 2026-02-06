import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class SubscriberModel extends BaseModel {
  /**
   * Target ID.
   */
  @Expose() targetId = '' // Default to empty string

  /**
   * Target.
   */
  @Expose() target: Record<string, any> = {} // Default to empty object

  /**
   * User ID.
   */
  @Expose() userId = '' // Default to empty string

  /**
   * User Name.
   */
  @Expose() userName = '' // Default to empty string

  /**
   * Topic ID.
   */
  @Expose() topicId = '' // Default to empty string

  /**
   * The target provider type. Can be one of the following: `email`, `sms` or `push`.
   */
  @Expose() providerType = '' // Default to empty string

  constructor(partial: Partial<SubscriberModel>) {
    super()
    Object.assign(this, partial)
  }
}
