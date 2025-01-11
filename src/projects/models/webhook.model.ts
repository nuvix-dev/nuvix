import { Expose } from "class-transformer";
import BaseModel, { BaseListModel } from "src/core/models/base.model";


export class WebhookModel extends BaseModel {
  /**
   * Webhook name.
   */
  @Expose() name: string;
  /**
   * Webhook URL endpoint.
   */
  @Expose() url: string;
  /**
   * Webhook trigger events.
   */
  @Expose() events: string[];
  /**
   * Indicated if SSL / TLS Certificate verification is enabled.
   */
  @Expose() security: boolean;
  /**
   * HTTP basic authentication username.
   */
  @Expose() httpUser: string;
  /**
   * HTTP basic authentication password.
   */
  @Expose() httpPass: string;
  /**
   * Signature key which can be used to validated incoming
   */
  @Expose() signatureKey: string;
  /**
   * Indicates if this webhook is enabled.
   */
  @Expose() enabled: boolean;
  /**
   * Webhook error logs from the most recent failure.
   */
  @Expose() logs: string;
  /**
   * Number of consecutive failed webhook attempts.
   */
  @Expose() attempts: number;

  constructor(data: Partial<WebhookModel | any> = {}) {
    super(data);
  }
}

export class WebhookListModel extends BaseListModel {
  /**
   * List of webhooks.
   */
  webhooks: WebhookModel[];

  constructor(data: Partial<WebhookListModel | any> = {}) {
    super();
    this.webhooks = data.webhooks ? data.webhooks.map((webhook: any) => new WebhookModel(webhook)) : [];
    this.total = data.total || 0;
  }
}