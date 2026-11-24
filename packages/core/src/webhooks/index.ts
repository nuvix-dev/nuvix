/** Webhook delivery safety helpers (SSRF guard). */
export {
  inspectWebhookUrl,
  isBlockedAddress,
  validateWebhookUrl,
  type WebhookUrlCheck,
  type WebhookUrlOptions,
} from './url'
