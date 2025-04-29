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
  @Expose() streetAddress: string;
  /**
   * Address line 2
   */
  @Expose() addressLine2: string;
  /**
   * Address country
   */
  @Expose() country: string;
  /**
   * city
   */
  @Expose() city: string;
  /**
   * state
   */
  @Expose() state: string;
  /**
   * postal code
   */
  @Expose() postalCode: string;
}
