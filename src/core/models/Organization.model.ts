import { Exclude, Expose } from 'class-transformer';
import BaseModel from './base.model';

@Exclude()
export class OrganizationModel extends BaseModel {
  /**
   * Team name.
   */
  @Expose() name: string;
  /**
   * Total number of team members.
   */
  @Expose() total: number;
  /**
   * Team preferences as a key-value object
   */
  @Expose() prefs: object;
  /**
   * Project budget limit
   */
  @Expose() billingBudget: number;
  /**
   * Project budget limit
   */
  @Expose() budgetAlerts: string[];
  /**
   * Billing plan selected. Can be one of `tier-0`, `tier-1` or `tier-2`.
   */
  @Expose() billingPlan: string;
  /**
   * Billing email set for the organization.
   */
  @Expose() billingEmail: string;
  /**
   * Billing cycle start date.
   */
  @Expose() billingStartDate: string;
  /**
   * Current invoice cycle start date.
   */
  @Expose() billingCurrentInvoiceDate: string;
  /**
   * Next invoice cycle start date.
   */
  @Expose() billingNextInvoiceDate: string;
  /**
   * Start date of trial.
   */
  @Expose() billingTrialStartDate: string;
  /**
   * Number of trial days.
   */
  @Expose() billingTrialDays: number;
  /**
   * Current active aggregation id.
   */
  @Expose() billingAggregationId: string;
  /**
   * Default payment method.
   */
  @Expose() paymentMethodId: string;
  /**
   * Default payment method.
   */
  @Expose() billingAddressId: string;
  /**
   * Backup payment method.
   */
  @Expose() backupPaymentMethodId: string;
  /**
   * Organization agreements
   */
  @Expose() agreementBAA: string;
  /**
   * Program manager&#039;s name.
   */
  @Expose() programManagerName: string;
  /**
   * Program manager&#039;s calendar link.
   */
  @Expose() programManagerCalendar: string;
  /**
   * Program&#039;s discord channel name.
   */
  @Expose() programDiscordChannelName: string;
  /**
   * Program&#039;s discord channel URL.
   */
  @Expose() programDiscordChannelUrl: string;
  /**
   * Billing limits reached
   */
  @Expose() billingLimits: object;
  /**
   * Billing plan downgrade
   */
  @Expose() billingPlanDowngrade: object;
  /**
   * Tax Id
   */
  @Expose() billingTaxId: string;
  /**
   * Marked for deletion
   */
  @Expose() markedForDeletion: boolean;
}
