/** Outbound URL safety helpers (SSRF guard) shared by webhook delivery and the favicon proxy. */
export {
  inspectOutboundUrl,
  isBlockedAddress,
  type OutboundUrlCheck,
  type OutboundUrlOptions,
  validateOutboundUrl,
} from './url-safety'
