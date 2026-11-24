/** Avatar generation service: builds location-based placeholder avatars and serves uploaded profile files. */
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { validateOutboundUrl } from '@nuvix/core/url-safety'
import type { Translator } from '@nuvix/i18n'
import { Resvg } from '@resvg/resvg-js'
import QRCode from 'qrcode'
import { avatarFontFile, avatarsDir } from '../assets'
import { NotFoundError } from '../shared/errors'

/** Provides avatar rendering, static asset resizing, QR generation, and SSRF-guarded favicon proxying. */

export type AvatarSet = 'flags' | 'browsers' | 'credit-cards'

const CODE_RE = /^[a-z0-9-]+$/i
const MAX_DIM = 2000

const clampDim = (v: number | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(MAX_DIM, Math.max(1, Math.trunc(n))) : fallback
}

/** Scan an asset directory once; code = filename without extension. */
async function loadSet(dir: string): Promise<Set<string>> {
  const entries = await readdir(path.join(avatarsDir, dir))
  return new Set(entries.map((f) => path.basename(f, path.extname(f)).toLowerCase()))
}

export interface AvatarResult {
  body: Uint8Array
  contentType: string
  headers: Record<string, string>
}

const AVATAR_CACHE = { 'Cache-Control': 'public, max-age=86400, immutable' }
const FAVICON_CACHE = { 'Cache-Control': 'public, max-age=3600' }

export function createAvatarService() {
  // Start asset scans eagerly so requests do not repeat directory discovery.
  const sets = {
    flags: loadSet('flags'),
    browsers: loadSet('browsers'),
    'credit-cards': loadSet('credit-cards'),
  }

  async function assertCode(set: AvatarSet, code: string): Promise<string> {
    if (!CODE_RE.test(code)) {
      throw new NotFoundError('Unknown avatar code', {
        code: 'unknown_avatar_code',
        messageKey: 'errors.avatars.unknownCode',
        params: { code },
      })
    }
    const normalized = code.toLowerCase()
    if (!(await sets[set]).has(normalized)) {
      throw new NotFoundError('Unknown avatar code', {
        code: 'unknown_avatar_code',
        messageKey: 'errors.avatars.unknownCode',
        params: { code },
      })
    }
    return normalized
  }

  /** Resize a static asset to exact dimensions via the Bun.Image pipeline. */
  async function resize(
    set: AvatarSet,
    code: string,
    width: number,
    height: number,
  ): Promise<AvatarResult> {
    const normalized = await assertCode(set, code)
    const file = Bun.file(path.join(avatarsDir, set, `${normalized}.png`))
    const body = await file.image().resize(width, height, { fit: 'fill' }).png().bytes()
    return { body, contentType: 'image/png', headers: AVATAR_CACHE }
  }

  function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return 'NA'
    const first = Array.from(words[0]!)[0]?.toUpperCase() ?? 'N'
    const second =
      words.length > 1
        ? Array.from(words[1]!)[0]?.toUpperCase()
        : Array.from(words[0]!)[1]?.toUpperCase()
    return (first + (second ?? '')).slice(0, 2)
  }

  function hslFromName(name: string): string {
    let hash = 2166136261
    for (let i = 0; i < name.length; i++) {
      hash ^= name.charCodeAt(i)
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
    }
    hash >>>= 0
    return `hsl(${hash % 360}, 65%, 55%)`
  }

  function initialsSVG(
    initials: string,
    width: number,
    height: number,
    background: string,
    circle: boolean,
  ): string {
    const safe = initials
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;')
    const size = Math.min(width, height)
    const fontSize = safe.length === 1 ? size * 0.55 : safe.length === 2 ? size * 0.45 : size * 0.35
    const radius = size / 2 - 1
    const shape = circle
      ? `<circle cx="${width / 2}" cy="${height / 2}" r="${radius}" fill="${background}" />`
      : `<rect width="100%" height="100%" fill="${background}" />`
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${shape}
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#ffffff"
    font-family="Varela, Arial, sans-serif" font-size="${fontSize}" font-weight="600">${safe}</text>
</svg>`
  }

  /** Render initials avatar: SVG template -> resvg -> PNG. */
  async function initials(opts: {
    name?: string
    width?: number
    height?: number
    background?: string
    circle?: boolean
  }): Promise<AvatarResult> {
    // Use a stable placeholder when no display name is available.
    const name = opts.name?.trim() ? opts.name : 'NA'
    const width = clampDim(opts.width, 500)
    const height = clampDim(opts.height, 500)

    const hex = opts.background?.replace(/[^0-9a-fA-F]/g, '')
    const background = hex && (hex.length === 3 || hex.length === 6) ? `#${hex}` : hslFromName(name)

    const svg = initialsSVG(getInitials(name), width, height, background, !!opts.circle)
    const png = new Resvg(svg, {
      font: {
        loadSystemFonts: false,
        defaultFontFamily: 'Varela, Arial, sans-serif',
        fontFiles: [avatarFontFile],
      },
    })
      .render()
      .asPng()

    return {
      body: new Uint8Array(png),
      contentType: 'image/png',
      headers: AVATAR_CACHE,
    }
  }

  const clampRange = (v: number | undefined, fallback: number, min: number, max: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback
  }

  async function qr(
    text: string,
    size: number,
    margin: number,
    download: boolean,
  ): Promise<AvatarResult> {
    const buffer = await QRCode.toBuffer(text, {
      type: 'png',
      width: clampRange(size, 400, 1, 1000),
      margin: clampRange(margin, 1, 0, 10),
    })
    const headers: Record<string, string> = {
      ...AVATAR_CACHE,
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="qr.png"`,
    }
    return { body: new Uint8Array(buffer), contentType: 'image/png', headers }
  }

  // Favicon proxy with protocol, hostname, DNS, redirect, and content-type checks.

  /**
   * Fetch a remote favicon and re-encode it as PNG after validating every redirect hop.
   */
  async function favicon(url: string): Promise<AvatarResult> {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new NotFoundError('Favicon unavailable', {
        code: 'favicon_unavailable',
        messageKey: 'errors.avatars.faviconUnavailable',
      })
    }

    let currentUrl = parsed
    let response: Response
    const MAX_REDIRECTS = 3
    try {
      let hops = 0
      while (true) {
        // Shared SSRF guard (same rules as webhook delivery): scheme,
        // embedded credentials, literal ranges, and every DNS answer for
        // this hop — re-checked on each redirect (rebinding included).
        const check = await validateOutboundUrl(currentUrl.href)
        if (!check.ok) {
          throw new Error('SSRF blocked')
        }

        response = await fetch(currentUrl, {
          redirect: 'manual',
          signal: AbortSignal.timeout(10_000),
          headers: { accept: 'image/*' },
        })

        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (hops >= MAX_REDIRECTS) {
            throw new Error('Too many redirects')
          }
          const location = response.headers.get('location')
          if (!location) {
            throw new Error('Missing redirect location')
          }
          currentUrl = new URL(location, currentUrl)
          hops++
          continue
        }
        break
      }
    } catch {
      throw new NotFoundError('Favicon unavailable', {
        code: 'favicon_unavailable',
        messageKey: 'errors.avatars.faviconUnavailable',
      })
    }

    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
      throw new NotFoundError('Favicon unavailable', {
        code: 'favicon_unavailable',
        messageKey: 'errors.avatars.faviconUnavailable',
      })
    }

    try {
      const bytes = await response.bytes()
      const body = await new Blob([bytes]).image().resize(256, 256, { fit: 'inside' }).png().bytes()
      return { body, contentType: 'image/png', headers: FAVICON_CACHE }
    } catch {
      throw new NotFoundError('Favicon unavailable', {
        code: 'favicon_unavailable',
        messageKey: 'errors.avatars.faviconUnavailable',
      })
    }
  }

  return { resize, initials, qr, favicon }
}

export type AvatarService = ReturnType<typeof createAvatarService>

/** Shared translator type re-export for route typing convenience. */
export type { Translator }
