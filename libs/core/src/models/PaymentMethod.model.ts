import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from './base.model';

@Exclude()
export class PaymentMethodModel extends BaseModel {
  /**
   * Payment method ID from the payment provider
   */
  @Expose() declare providerMethodId: string;
  /**
   * Client secret hash for payment setup
   */
  @Expose() declare clientSecret: string;
  /**
   * User ID from the payment provider.
   */
  @Expose() declare providerUserId: string;
  /**
   * ID of the Team.
   */
  @Expose() declare userId: string;
  /**
   * Expiry month of the payment method.
   */
  @Expose() declare expiryMonth: number;
  /**
   * Expiry year of the payment method.
   */
  @Expose() declare expiryYear: number;
  /**
   * Last 4 digit of the payment method
   */
  @Expose() declare last4: string;
  /**
   * Payment method brand
   */
  @Expose() declare brand: string;
  /**
   * Name of the owner
   */
  @Expose() declare name: string;
  /**
   * Mandate ID of the payment method
   */
  @Expose() declare mandateId: string;
  /**
   * Country of the payment method
   */
  @Expose() declare country: string;
  /**
   * Last payment error associated with the payment method.
   */
  @Expose() declare lastError: string;
  /**
   * True when it&#039;s the default payment method.
   */
  @Expose() declare default: boolean;
  /**
   * True when payment method has expired.
   */
  @Expose() declare expired: boolean;
  /**
   * True when payment method has failed to process multiple times.
   */
  @Expose() declare failed: boolean;
}
