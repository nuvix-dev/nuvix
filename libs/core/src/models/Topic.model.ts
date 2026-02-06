import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class TopicModel extends BaseModel {
  /**
   * The name of the topic.
   */
  @Expose() name = '' // Default to empty string

  /**
   * Total count of email subscribers subscribed to the topic.
   */
  @Expose() emailTotal = 0 // Default to 0

  /**
   * Total count of SMS subscribers subscribed to the topic.
   */
  @Expose() smsTotal = 0 // Default to 0

  /**
   * Total count of push subscribers subscribed to the topic.
   */
  @Expose() pushTotal = 0 // Default to 0

  /**
   * Subscribe permissions.
   */
  @Expose() subscribe: string[] = ['users'] // Default to array with 'users'

  constructor(partial: Partial<TopicModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}
