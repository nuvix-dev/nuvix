import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from './base.model';

@Exclude()
export class InvoiceModel extends BaseModel {
  /**
   * Project ID
   */
  @Expose() declare teamId: string;
  /**
   * Aggregation ID
   */
  @Expose() declare aggregationId: string;
  /**
   * Billing plan selected. Can be one of `tier-0`, `tier-1` or `tier-2`.
   */
  @Expose() declare plan: string;
  /**
   * Usage breakdown per resource
   */
  @Expose() declare usage: object;
  /**
   * Invoice Amount
   */
  @Expose() declare amount: number;
  /**
   * Tax percentage
   */
  @Expose() declare tax: number;
  /**
   * Tax amount
   */
  @Expose() declare taxAmount: number;
  /**
   * VAT percentage
   */
  @Expose() declare vat: number;
  /**
   * VAT amount
   */
  @Expose() declare vatAmount: number;
  /**
   * Gross amount after vat, tax, and discounts applied.
   */
  @Expose() declare grossAmount: number;
  /**
   * Credits used.
   */
  @Expose() declare creditsUsed: number;
  /**
   * Currency the invoice is in
   */
  @Expose() declare currency: string;
  /**
   * Client secret for processing failed payments in front-end
   */
  @Expose() declare clientSecret: string;
  /**
   * Invoice status
   */
  @Expose() declare status: string;
  /**
   * Last payment error associated with the invoice
   */
  @Expose() declare lastError: string;
  /**
   * Invoice due date.
   */
  @Expose() declare dueAt: string;
  /**
   * Beginning date of the invoice
   */
  @Expose() declare from: string;
  /**
   * End date of the invoice
   */
  @Expose() declare to: string;
}
