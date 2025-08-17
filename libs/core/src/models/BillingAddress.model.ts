import { Exclude, Expose } from 'class-transformer';
import BaseModel from './base.model';

@Exclude()
export class BillingAddressModel extends BaseModel {
  /**
   * Region ID
   */
  @Expose() declare $id: string;
  /**
   * Street address
   */
  @Expose() declare streetAddress: string;
  /**
   * Address line 2
   */
  @Expose() declare addressLine2: string;
  /**
   * Address country
   */
  @Expose() declare country: string;
  /**
   * city
   */
  @Expose() declare city: string;
  /**
   * state
   */
  @Expose() declare state: string;
  /**
   * postal code
   */
  @Expose() declare postalCode: string;
}
