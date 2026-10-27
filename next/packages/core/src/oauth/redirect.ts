/**
 * Redirect URL validation for the OAuth2 and magic-URL flows.
 *
 * A redirect target is valid when:
 * - its scheme is a web scheme (http/https/browser-extension) AND its
 *   hostname matches a registered web platform hostname, or
 * - its scheme matches a registered custom-scheme platform (`type: scheme`,
 *   `key: <scheme>`), or one of the reserved per-app native schemes.
 */

export interface PlatformConfig {
  type?: string
  hostname?: string | null
  key?: string | null
}

/** Schemes treated as web URLs (host must match a registered platform). */
const WEB_SCHEMES = new Set([
  'http',
  'https',
  'chrome-extension',
  'moz-extension',
  'safari-web-extension',
  'ms-edge-extension',
])

/** Platform types whose `key` carries a bundle-style hostname/pattern. */
const FLUTTER_MULTIPLATFORM_TYPES = new Set([
  'flutter-ios',
  'flutter-android',
  'flutter-macos',
  'flutter-windows',
  'flutter-linux',
  'flutter-tvos',
  'android',
  'apple-ios',
  'apple-macos',
  'apple-watchos',
  'apple-tvos',
  'unity',
  'react-native-ios',
  'react-native-android',
])

/** Hostnames allowed for redirect validation, derived from project platforms. */
export function platformHostnames(platforms: PlatformConfig[]): string[] {
  const hostnames = new Set<string>()
  for (const platform of platforms) {
    const type = (platform.type ?? 'unknown').toLowerCase()
    const hostname = (platform.hostname ?? '').toLowerCase()
    const key = (platform.key ?? '').toLowerCase()

    if (type === 'web' || type === 'flutter-web') {
      if (hostname) hostnames.add(hostname)
    } else if (FLUTTER_MULTIPLATFORM_TYPES.has(type)) {
      if (key) hostnames.add(key)
    }
  }
  return [...hostnames]
}

/** Schemes allowed for redirect validation, derived from project platforms. */
export function platformSchemes(projectId: string, platforms: PlatformConfig[]): string[] {
  const schemes = new Set<string>(['http', 'https', 'exp', `nuvix-callback-${projectId}`])
  for (const platform of platforms) {
    const type = (platform.type ?? 'unknown').toLowerCase()
    const scheme = (platform.key ?? '').toLowerCase()
    if (type === 'web' || type === 'flutter-web') continue
    if (type === 'scheme') {
      if (/^[a-z][a-z0-9+.-]*$/.test(scheme)) schemes.add(scheme)
    }
  }
  return [...schemes]
}

/** Extract the scheme portion of a URI, tolerating non-URL custom schemes. */
export function parseScheme(uri: string): string | undefined {
  const trimmed = uri.trim()
  if (trimmed === '') return undefined
  try {
    return new URL(trimmed).protocol.slice(0, -1)
  } catch {
    const match = trimmed.match(/^([a-z][a-z0-9+.-]*):/i)
    return match ? match[1]?.toLowerCase() : undefined
  }
}

/** Precomputed validation rules for a project's registered platforms. */
export interface RedirectRules {
  hostnames: string[]
  schemes: string[]
}

/** Assemble hostnames + schemes in one call for flow handlers. */
export function redirectRules(projectId: string, platforms: PlatformConfig[]): RedirectRules {
  return {
    hostnames: platformHostnames(platforms),
    schemes: platformSchemes(projectId, platforms),
  }
}

/**
 * Validates a redirect (success/failure) URL against the project's registered
 * platforms — rejects open-redirects to unregistered origins. Returns the
 * failure description used to build the problem detail when invalid.
 */
export function validateRedirectURL(url: string, rules: RedirectRules): string | null {
  const scheme = parseScheme(url)
  if (!scheme) return 'Invalid URI.'

  if (WEB_SCHEMES.has(scheme)) {
    let host: string
    try {
      host = new URL(url).hostname.toLowerCase()
    } catch {
      return 'Invalid URI.'
    }
    if (!host) return 'Invalid URI.'
    if (rules.hostnames.includes(host)) return null
    return `Invalid URI. Register your new client (${host}) as a new Web platform on your project console dashboard`
  }

  if (rules.schemes.includes(scheme)) return null
  return `Invalid Scheme. The scheme used (${scheme}) is not supported. If you are using a custom scheme, please change it to \`nuvix-callback-<PROJECT_ID>\``
}
