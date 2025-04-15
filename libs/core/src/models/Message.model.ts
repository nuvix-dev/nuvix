import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class MessageModel extends BaseModel {
  /**
   * Message provider type.
   */
  @Expose() providerType: string = '';

  /**
   * Topic IDs set as recipients.
   */
  @Expose() topics: string[] = []; // Default to empty array

  /**
   * User IDs set as recipients.
   */
  @Expose() users: string[] = []; // Default to empty array

  /**
   * Target IDs set as recipients.
   */
  @Expose() targets: string[] = []; // Default to empty array

  /**
   * The scheduled time for the message.
   */
  @Expose() scheduledAt?: string; // Optional, no default value

  /**
   * The time when the message was delivered.
   */
  @Expose() deliveredAt?: string; // Optional, no default value

  /**
   * Delivery errors if any.
   */
  @Expose() deliveryErrors: string[] = []; // Default to empty array

  /**
   * Number of recipients the message was delivered to.
   */
  @Expose() deliveredTotal: number = 0;

  /**
   * Data of the message.
   */
  @Expose() data: Record<string, any> = {}; // Default to empty object

  /**
   * Status of delivery.
   */
  @Expose() status: string = 'draft'; // Default to 'draft'

  constructor(partial: Partial<MessageModel>) {
    super();
    Object.assign(this, partial);
  }
}
