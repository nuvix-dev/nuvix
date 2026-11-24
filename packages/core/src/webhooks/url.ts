/**
 * Webhook URL safety (SSRF guard).
 *
 * Two entry points with deliberately different cost/coverage:
 *
 * - {@link inspectWebhookUrl} — synchronous, no network. Rejects non-HTTP(S)
 *   schemes, embedded credentials, IP-literal internal ranges, and known
 *   internal hostnames. Used when an operator registers or updates a webhook,
 *   so the API stays fast and hermetic.
 * - {@link validateWebhookUrl} — `inspect` plus DNS resolution, rejecting
 *   names that resolve to internal addresses. Used immediately before the
 *   outbound delivery, because DNS can change between registration and send
 *   (rebinding) and literal-only checks are not sufficient.
 *
 * Both fail closed: anything unrecognized is treated as unsafe.
 */

import { lookup as dnsLookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

/** Result of a URL safety check. */
export type WebhookUrlCheck = { ok: true } | { ok: false; reason: string }

/** Injectable DNS seam; resolves a hostname to every address it maps to. */
export interface WebhookUrlOptions {
  resolve?: (hostname: string) => Promise<string[]>
}

/**
 * Address ranges that must never be reachable from a webhook delivery:
 * loopback, private, link-local (cloud metadata), CGNAT, multicast,
 * documentation/benchmark blocks, and IPv6 equivalents.
 */
const blocked = new BlockList()

// IPv4
blocked.addSubnet('0.0.0.0', 8, 'ipv4') // "this network"
blocked.addSubnet('10.0.0.0', 8, 'ipv4') // RFC 1918
blocked.addSubnet('100.64.0.0', 10, 'ipv4') // CGNAT
blocked.addSubnet('127.0.0.0', 8, 'ipv4') // loopback
blocked.addSubnet('169.254.0.0', 16, 'ipv4') // link-local + cloud metadata
blocked.addSubnet('172.16.0.0', 12, 'ipv4') // RFC 1918
blocked.addSubnet('192.0.0.0', 24, 'ipv4') // IETF protocol assignments
blocked.addSubnet('192.0.2.0', 24, 'ipv4') // TEST-NET-1
blocked.addSubnet('192.168.0.0', 16, 'ipv4') // RFC 1918
blocked.addSubnet('198.18.0.0', 15, 'ipv4') // benchmarking
blocked.addSubnet('198.51.100.0', 24, 'ipv4') // TEST-NET-2
blocked.addSubnet('203.0.113.0', 24, 'ipv4') // TEST-NET-3
blocked.addSubnet('224.0.0.0', 4, 'ipv4') // multicast
blocked.addSubnet('240.0.0.0', 4, 'ipv4') // reserved + broadcast

// IPv6
blocked.addSubnet('::', 128, 'ipv6') // unspecified
blocked.addSubnet('::1', 128, 'ipv6') // loopback
blocked.addSubnet('::', 96, 'ipv6') // IPv4-compatible (deprecated)
blocked.addSubnet('64:ff9b::', 96, 'ipv6') // NAT64
blocked.addSubnet('100::', 64, 'ipv6') // discard-only
blocked.addSubnet('2001:db8::', 32, 'ipv6') // documentation
blocked.addSubnet('2002::', 16, 'ipv6') // 6to4
blocked.addSubnet('fc00::', 7, 'ipv6') // unique local
blocked.addSubnet('fe80::', 10, 'ipv6') // link-local
blocked.addSubnet('ff00::', 8, 'ipv6') // multicast

/** Hostnames that always denote internal targets, regardless of DNS. */
const blockedHostnames = [
  /^localhost$/,
  /\.localhost$/,
  /^localhost\.localdomain$/,
  /\.localdomain$/,
  /\.local$/,
  /\.internal$/,
  /\.home\.arpa$/,
  /^metadata\.google\.internal$/,
  /^metadata\.goog$/,
]

/** Whether an IP literal points at a non-public address. Fails closed. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return blocked.check(address, 'ipv4')
  if (family === 6) {
    // IPv4-mapped literals (::ffff:a.b.c.d) are never produced by DNS and
    // are only useful for smuggling an IPv4 target past v4-only checks.
    if (address.toLowerCase().startsWith('::ffff:')) return true
    return blocked.check(address, 'ipv6')
  }
  return true
}

/**
 * Synchronous, network-free URL check: scheme, credentials, literal IPs,
 * and internal hostnames. Safe to call on every registration/update.
 */
export function inspectWebhookUrl(rawUrl: string): WebhookUrlCheck {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'not a valid absolute URL' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `unsupported protocol "${url.protocol}" (http or https only)` }
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'URL must not embed credentials; use httpUser/httpPass' }
  }

  // `URL` normalizes numeric/hex IPv4 forms (e.g. http://2130706433/) to a
  // dotted quad, so a single literal check covers those obfuscations.
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!hostname) return { ok: false, reason: 'URL has no host' }

  if (isIP(hostname)) {
    return isBlockedAddress(hostname)
      ? { ok: false, reason: `address ${hostname} is not a public address` }
      : { ok: true }
  }

  if (blockedHostnames.some((pattern) => pattern.test(hostname))) {
    return { ok: false, reason: `hostname "${hostname}" refers to a private or internal name` }
  }

  return { ok: true }
}

/**
 * Synchronous check plus DNS resolution: every address the hostname maps to
 * must be public. A resolution failure is treated as unsafe (fail closed —
 * the outbound client would otherwise resolve independently).
 */
export async function validateWebhookUrl(
  rawUrl: string,
  options: WebhookUrlOptions = {},
): Promise<WebhookUrlCheck> {
  const inspected = inspectWebhookUrl(rawUrl)
  if (!inspected.ok) return inspected

  const hostname = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, '')
  // Literal IPs were fully checked by `inspectWebhookUrl`.
  if (isIP(hostname)) return { ok: true }

  const resolve = options.resolve ?? defaultResolve
  let addresses: string[]
  try {
    addresses = await resolve(hostname)
  } catch {
    return { ok: false, reason: `could not resolve "${hostname}"` }
  }

  if (addresses.length === 0) {
    return { ok: false, reason: `could not resolve "${hostname}"` }
  }
  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      return { ok: false, reason: `"${hostname}" resolves to a non-public address (${address})` }
    }
  }
  return { ok: true }
}

/** Default resolver: every A/AAAA record for the hostname. */
async function defaultResolve(hostname: string): Promise<string[]> {
  const results = await dnsLookup(hostname, { all: true, verbatim: true })
  return results.map((result) => result.address)
}
