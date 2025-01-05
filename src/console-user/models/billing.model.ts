import { Exclude, Expose } from "class-transformer";
import BaseModel, { BaseListModel } from "src/core/models/base.model";


@Exclude()
export class BillingAddressModel extends BaseModel {
  /**
     * Region ID
   */
  @Expose() $id: string;
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

  constructor(data: Partial<BillingAddressModel | Document> = {}) {
    super(data);
  }
}


export class BillingAddressListModel extends BaseListModel {

  plans: BillingAddressModel[];

  constructor(partial: Partial<BillingAddressListModel | { plans: Document[] | { [key: string]: string }[] }>) {
    super();
    if (partial.plans) {
      this.plans = partial.plans.map((user: any) => new BillingAddressModel(user));
    }
    Object.assign(this, { ...partial, plans: this.plans });
  }
}
