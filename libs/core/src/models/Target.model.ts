import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class TargetModel extends BaseModel {
  /**
   * Target Name.
   */
  @Expose() name = '' // Default to empty string

  /**
   * User ID.
   */
  @Expose() userId = '' // Default to empty string

  /**
   * Provider ID.
   */
  @Expose() providerId = '' // Default to empty string

  /**
   * The target provider type. Can be one of the following: `email`, `sms` or `push`.
   */
  @Expose() providerType = '' // Default to empty string

  /**
   * The target identifier.
   */
  @Expose() identifier = '' // Default to empty string

  constructor(partial: Partial<TargetModel>) {
    super()
    Object.assign(this, partial)
  }
}
