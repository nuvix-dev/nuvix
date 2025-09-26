import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from './base.model';

@Exclude()
export class OrganizationModel extends BaseModel {
  /**
   * Team name.
   */
  @Expose() declare name: string;
  /**
   * Total number of team members.
   */
  @Expose() declare total: number;
  /**
   * Team preferences as a key-value object
   */
  @Expose() declare prefs: object;
  /**
   * Project budget limit
   */
  @Expose() declare billingBudget: number;
  /**
   * Project budget limit
   */
  @Expose() declare budgetAlerts: string[];
  /**
   * Billing plan selected. Can be one of `tier-0`, `tier-1` or `tier-2`.
   */
  @Expose() declare billingPlan: string;
  /**
   * Billing email set for the organization.
   */
  @Expose() declare billingEmail: string;
  /**
   * Billing cycle start date.
   */
  @Expose() declare billingStartDate: string;
  /**
   * Current invoice cycle start date.
   */
  @Expose() declare billingCurrentInvoiceDate: string;
  /**
   * Next invoice cycle start date.
   */
  @Expose() declare billingNextInvoiceDate: string;
  /**
   * Start date of trial.
   */
  @Expose() declare billingTrialStartDate: string;
  /**
   * Number of trial days.
   */
  @Expose() declare billingTrialDays: number;
  /**
   * Current active aggregation id.
   */
  @Expose() declare billingAggregationId: string;
  /**
   * Default payment method.
   */
  @Expose() declare paymentMethodId: string;
  /**
   * Default payment method.
   */
  @Expose() declare billingAddressId: string;
  /**
   * Backup payment method.
   */
  @Expose() declare backupPaymentMethodId: string;
  /**
   * Organization agreements
   */
  @Expose() declare agreementBAA: string;
  /**
   * Program manager&#039;s name.
   */
  @Expose() declare programManagerName: string;
  /**
   * Program manager&#039;s calendar link.
   */
  @Expose() declare programManagerCalendar: string;
  /**
   * Program&#039;s discord channel name.
   */
  @Expose() declare programDiscordChannelName: string;
  /**
   * Program&#039;s discord channel URL.
   */
  @Expose() declare programDiscordChannelUrl: string;
  /**
   * Billing limits reached
   */
  @Expose() declare billingLimits: object;
  /**
   * Billing plan downgrade
   */
  @Expose() declare billingPlanDowngrade: object;
  /**
   * Tax Id
   */
  @Expose() declare billingTaxId: string;
  /**
   * Marked for deletion
   */
  @Expose() declare markedForDeletion: boolean;
}
