import { Exclude, Expose } from 'class-transformer';
import BaseModel from './base.model';

@Exclude()
export class BillingPlanModel extends BaseModel {
  /**
   * Plan name
   */
  @Expose() declare name: string;
  /**
   * Price
   */
  @Expose() declare price: number;
  /**
   * Trial days
   */
  @Expose() declare trial: number;
  /**
   * Bandwidth
   */
  @Expose() declare bandwidth: number;
  /**
   * Storage
   */
  @Expose() declare storage: number;
  /**
   * Members
   */
  @Expose() declare members: number;
  /**
   * Webhooks
   */
  @Expose() declare webhooks: number;
  /**
   * Platofrms
   */
  @Expose() declare platforms: number;
  /**
   * Users
   */
  @Expose() declare users: number;
  /**
   * Teams
   */
  @Expose() declare teams: number;
  /**
   * Databases
   */
  @Expose() declare databases: number;
  /**
   * Buckets
   */
  @Expose() declare buckets: number;
  /**
   * File size
   */
  @Expose() declare fileSize: number;
  /**
   * Functions
   */
  @Expose() declare functions: number;
  /**
   * Function executions
   */
  @Expose() declare executions: number;
  /**
   * Realtime connections
   */
  @Expose() declare realtime: number;
  /**
   * Log days
   */
  @Expose() declare logs: number;
  /**
   * Additional resources
   */
  @Expose() declare addons: object;
  /**
   * Custom SMTP
   */
  @Expose() declare customSmtp: boolean;
  /**
   * nuvix branding in email
   */
  @Expose() declare emailBranding: boolean;
  /**
   * Does plan require payment method
   */
  @Expose() declare requiresPaymentMethod: boolean;
  /**
   * Does plan require billing address
   */
  @Expose() declare requiresBillingAddress: boolean;
  /**
   * Is the billing plan available
   */
  @Expose() declare isAvailable: boolean;
  /**
   * Can user change the plan themselves
   */
  @Expose() declare selfService: boolean;
}
