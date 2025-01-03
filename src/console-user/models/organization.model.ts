import { Exclude, Expose } from 'class-transformer';
import { Document } from 'mongoose';
import { dataToObject } from 'src/core/helper/model.helper';
import BaseModel from 'src/core/models/base.model';

interface Preferences {
  [key: string]: string;
}

interface BillingLimits {
  [key: string]: any;
}

interface BillingPlanDowngrade {
  [key: string]: any;
}

@Exclude()
export default class OrganizationModel extends BaseModel {
  /**
   * Organization name.
   */
  @Expose() name: string;
  /**
   * Total number of Organization members.
   */
  @Expose() total: number = 0;
  /**
   * Organization preferences as a key-value object
   */
  @Expose() prefs: Preferences = {};
  /**
   * Project budget limit
   */
  @Expose() billingBudget: number = 0;
  /**
   * Project budget limit
   */
  @Expose() budgetAlerts: string[] = [];
  /**
   * Billing plan selected. Can be one of `tier-0`, `tier-1` or `tier-2`.
   */
  @Expose() billingPlan: string = 'tier-0';
  /**
   * Billing email set for the organization.
   */
  @Expose() billingEmail: string = '';
  /**
   * Billing cycle start date.
   */
  @Expose() billingStartDate: string = '';
  /**
   * Current invoice cycle start date.
   */
  @Expose() billingCurrentInvoiceDate: string = '';
  /**
   * Next invoice cycle start date.
   */
  @Expose() billingNextInvoiceDate: string = '';
  /**
   * Start date of trial.
   */
  @Expose() billingTrialStartDate: string = '';
  /**
   * Number of trial days.
   */
  @Expose() billingTrialDays: number = 0;
  /**
   * Current active aggregation id.
   */
  @Expose() billingAggregationId: string = '';
  /**
   * Default payment method.
   */
  @Expose() paymentMethodId: string = '';
  /**
   * Default payment method.
   */
  @Expose() billingAddressId: string = '';
  /**
   * Backup payment method.
   */
  @Expose() backupPaymentMethodId: string = '';
  /**
   * Organization agreements
   */
  @Expose() agreementBAA: string = '';
  /**
   * Program manager's name.
   */
  @Expose() programManagerName: string = '';
  /**
   * Program manager's calendar link.
   */
  @Expose() programManagerCalendar: string = '';
  /**
   * Program's discord channel name.
   */
  @Expose() programDiscordChannelName: string = '';
  /**
   * Program's discord channel URL.
   */
  @Expose() programDiscordChannelUrl: string = '';
  /**
   * Billing limits reached
   */
  @Expose() billingLimits: BillingLimits = {};
  /**
   * Billing plan downgrade
   */
  @Expose() billingPlanDowngrade: BillingPlanDowngrade = {};
  /**
   * Tax Id
   */
  @Expose() billingTaxId: string = '';
  /**
   * Marked for deletion
   */
  @Expose() markedForDeletion: boolean = false;

  constructor(partial: Partial<OrganizationModel> | Document) {
    super();
    Object.assign(this, dataToObject(partial));
  }
}

export class OrganizationListModel {
  /**
   * Total number of organizations.
   */
  total: number = 0;

  /**
   * List of organizations.
   */
  organizations: OrganizationModel[] = [];

  /**
   * FOR INTERNAL USE ONLY
   */
  teams: OrganizationModel[] = [];

  constructor(partial: Partial<OrganizationListModel | { organizations: Document[] | { [key: string]: string }[] }>) {
    if (partial.organizations) {
      this.organizations = partial.organizations.map((org) => new OrganizationModel(org))
    }
    Object.assign(this, { ...partial, organizations: this.organizations, teams: this.organizations });
  }
}