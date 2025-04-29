import { Exclude, Expose } from 'class-transformer';
import BaseModel from './base.model';

@Exclude()
export class BillingPlanModel extends BaseModel {
  /**
   * Plan ID.
   */
  @Expose() declare $id: string;
  /**
   * Plan name
   */
  @Expose() name: string;
  /**
   * Price
   */
  @Expose() price: number;
  /**
   * Trial days
   */
  @Expose() trial: number;
  /**
   * Bandwidth
   */
  @Expose() bandwidth: number;
  /**
   * Storage
   */
  @Expose() storage: number;
  /**
   * Members
   */
  @Expose() members: number;
  /**
   * Webhooks
   */
  @Expose() webhooks: number;
  /**
   * Platofrms
   */
  @Expose() platforms: number;
  /**
   * Users
   */
  @Expose() users: number;
  /**
   * Teams
   */
  @Expose() teams: number;
  /**
   * Databases
   */
  @Expose() databases: number;
  /**
   * Buckets
   */
  @Expose() buckets: number;
  /**
   * File size
   */
  @Expose() fileSize: number;
  /**
   * Functions
   */
  @Expose() functions: number;
  /**
   * Function executions
   */
  @Expose() executions: number;
  /**
   * Realtime connections
   */
  @Expose() realtime: number;
  /**
   * Log days
   */
  @Expose() logs: number;
  /**
   * Additional resources
   */
  @Expose() addons: object;
  /**
   * Custom SMTP
   */
  @Expose() customSmtp: boolean;
  /**
   * nuvix branding in email
   */
  @Expose() emailBranding: boolean;
  /**
   * Does plan require payment method
   */
  @Expose() requiresPaymentMethod: boolean;
  /**
   * Does plan require billing address
   */
  @Expose() requiresBillingAddress: boolean;
  /**
   * Is the billing plan available
   */
  @Expose() isAvailable: boolean;
  /**
   * Can user change the plan themselves
   */
  @Expose() selfService: boolean;
}
