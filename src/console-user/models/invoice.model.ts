import { Exclude, Expose } from "class-transformer";
import BaseModel, { BaseListModel } from "src/core/models/base.model";

@Exclude()
export class InvoiceModel extends BaseModel {
  /**
   * Project ID
   */
  @Expose() teamId: string;
  /**
   * Aggregation ID
   */
  @Expose() aggregationId: string;
  /**
   * Billing plan selected. Can be one of `tier-0`, `tier-1` or `tier-2`.
   */
  @Expose() plan: string;
  /**
   * Usage breakdown per resource
   */
  @Expose() usage: object;
  /**
   * Invoice Amount
   */
  @Expose() amount: number;
  /**
   * Tax percentage
   */
  @Expose() tax: number;
  /**
   * Tax amount
   */
  @Expose() taxAmount: number;
  /**
   * VAT percentage
   */
  @Expose() vat: number;
  /**
   * VAT amount
   */
  @Expose() vatAmount: number;
  /**
   * Gross amount after vat, tax, and discounts applied.
   */
  @Expose() grossAmount: number;
  /**
   * Credits used.
   */
  @Expose() creditsUsed: number;
  /**
   * Currency the invoice is in
   */
  @Expose() currency: string;
  /**
   * Client secret for processing failed payments in front-end
   */
  @Expose() clientSecret: string;
  /**
   * Invoice status
   */
  @Expose() status: string;
  /**
   * Last payment error associated with the invoice
   */
  @Expose() lastError: string;
  /**
   * Invoice due date.
   */
  @Expose() dueAt: string;
  /**
   * Beginning date of the invoice
   */
  @Expose() from: string;
  /**
   * End date of the invoice
   */
  @Expose() to: string;

  constructor(data: Partial<InvoiceModel>) {
    super(data);
  }
}


export class InvoicesListModel extends BaseListModel {
  @Expose()
  invoices: Partial<InvoiceModel[]> = [];

  constructor(data: Partial<InvoicesListModel | any>) {
    super();
    this.invoices = data.invoices ? data.invoices.map((invoice: any) => new InvoiceModel(invoice)) : [];
    this.total = data.total || 0;
  }
}