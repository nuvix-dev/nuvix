import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class WebhookModel extends BaseModel {
  /**
   * Webhook name.
   */
  @Expose() name: string = ''; // Default to empty string

  /**
   * Webhook URL endpoint.
   */
  @Expose() url: string = ''; // Default to empty string

  /**
   * Webhook trigger events.
   */
  @Expose() events: string[] = []; // Default to empty array

  /**
   * Indicates if SSL / TLS Certificate verification is enabled.
   */
  @Expose() security: boolean = true; // Default to true

  /**
   * HTTP basic authentication username.
   */
  @Expose() httpUser: string = ''; // Default to empty string

  /**
   * HTTP basic authentication password.
   */
  @Expose() httpPass: string = ''; // Default to empty string

  /**
   * Signature key which can be used to validate incoming requests.
   */
  @Expose() signatureKey: string = ''; // Default to empty string

  /**
   * Indicates if this webhook is enabled.
   */
  @Expose() enabled: boolean = true; // Default to true

  /**
   * Webhook error logs from the most recent failure.
   */
  @Expose() logs: string = ''; // Default to empty string

  /**
   * Number of consecutive failed webhook attempts.
   */
  @Expose() attempts: number = 0; // Default to 0

  constructor(partial: Partial<WebhookModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}
