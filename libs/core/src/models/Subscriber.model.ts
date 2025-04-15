import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class SubscriberModel extends BaseModel {
  /**
   * Target ID.
   */
  @Expose() targetId: string = ''; // Default to empty string

  /**
   * Target.
   */
  @Expose() target: Record<string, any> = {}; // Default to empty object

  /**
   * User ID.
   */
  @Expose() userId: string = ''; // Default to empty string

  /**
   * User Name.
   */
  @Expose() userName: string = ''; // Default to empty string

  /**
   * Topic ID.
   */
  @Expose() topicId: string = ''; // Default to empty string

  /**
   * The target provider type. Can be one of the following: `email`, `sms` or `push`.
   */
  @Expose() providerType: string = ''; // Default to empty string

  constructor(partial: Partial<SubscriberModel>) {
    super();
    Object.assign(this, partial);
  }
}
