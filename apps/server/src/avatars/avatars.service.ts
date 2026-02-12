import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { default as path } from 'node:path'
import { Injectable, Logger, StreamableFile } from '@nestjs/common'
import { PROJECT_ROOT } from '@nuvix/utils'
import { Resvg } from '@resvg/resvg-js'
import { browserCodes, creditCards, flags } from '@nuvix/core/config'
import { Exception } from '@nuvix/core/extend/exception'
import sharp from 'sharp'
import { CodesQuerDTO, InitialsQueryDTO } from './DTO/misc.dto'

@Injectable()
export class AvatarsService {
  private readonly logger = new Logger(AvatarsService.name)

  constructor() {}

  /**
   * Generates an avatar image based on the provided parameters.
   */
  async generateAvatar({
    name = 'NA',
    width,
    height,
    background,
    circle,
    quality,
    res,
  }: {
    res: NuvixRes
  } & InitialsQueryDTO) {
    try {
      const MAX_DIM = 2000
      const MIN_DIM = 0

      const toNum = (v: number | string, fallback: number) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : fallback
      }

      width = Math.min(MAX_DIM, Math.max(MIN_DIM, toNum(width, 100)))
      height = Math.min(MAX_DIM, Math.max(MIN_DIM, toNum(height, 100)))

      // Normalize background color
      if (background) {
        const hex = background.replace(/[^0-9a-fA-F]/g, '')
        background =
          hex.length === 3 || hex.length === 6
            ? `#${hex}`
            : this.getHSLColorFromName(name)
      } else {
        background = this.getHSLColorFromName(name)
      }

      const initials = this.getInitials(name)

      const cacheKey = this.generateCacheKey(
        initials,
        width,
        height,
        background,
        circle,
        quality,
      )

      const cachedImage = this.getCachedImage(cacheKey)
      if (cachedImage) {
        res.header('Content-Type', 'image/png')
        return new StreamableFile(cachedImage)
      }

      // Generate SVG
      const svg = this.generateAvatarSVG({
        initials,
        width,
        height,
        background,
        circle,
      })

      const fontPath = path.join(
        PROJECT_ROOT,
        'assets/fonts',
        'Varela-Regular.ttf',
      )
      const fontFiles = [fontPath]

      const resvg = new Resvg(svg, {
        font: {
          loadSystemFonts: false,
          defaultFontFamily: 'Varela, Arial, sans-serif',
          fontFiles,
        },
      })

      const pngBuffer = resvg.render().asPng()
      const processedImage = await sharp(pngBuffer)
        .resize(width, height)
        .png({
          quality,
          compressionLevel: 9,
          adaptiveFiltering: true,
          force: true,
        })
        .toBuffer()

      // Cache result
      this.cacheImage(cacheKey, processedImage)

      res.header('Content-Type', 'image/png')
      return new StreamableFile(processedImage)
    } catch (error) {
      this.logger?.error?.('Avatar generation failed', error)
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Avatar generation failed',
      )
    }
  }

  private generateAvatarSVG({
    initials,
    width,
    height,
    background,
    circle,
  }: {
    initials: string
    width: number
    height: number
    background: string
    circle: boolean
  }) {
    const safeInitials = this.escapeXML(initials)

    const size = Math.min(width, height)

    // Adaptive font size
    const fontSize =
      safeInitials.length === 1
        ? size * 0.55
        : safeInitials.length === 2
          ? size * 0.45
          : size * 0.35

    // Slight inset radius to avoid edge artifacts
    const radius = size / 2 - 1

    const shape = circle
      ? `<circle cx="${width / 2}" cy="${height / 2}" r="${radius}" fill="${background}" />`
      : `<rect width="100%" height="100%" fill="${background}" />`

    return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${shape}
  <text
    x="50%"
    y="50%"
    dominant-baseline="central"
    text-anchor="middle"
    fill="#ffffff"
    font-family="Varela, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="600"
  >
    ${safeInitials}
  </text>
</svg>`
  }

  private escapeXML(text: string) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  /**
   * Retrieves the image for a credit card based on the provided code and query parameters.
   */
  async getCreditCard({
    code,
    res,
    ...query
  }: { code: string; res: NuvixRes } & CodesQuerDTO) {
    return this.avatarCallback({
      type: 'credit-cards',
      code,
      ...query,
      res,
    })
  }

  /**
   * Retrieves the image for a browser based on the provided code and query parameters.
   */
  async getBrowser({
    code,
    res,
    ...query
  }: { code: string; res: NuvixRes } & CodesQuerDTO) {
    return this.avatarCallback({
      type: 'browsers',
      code,
      ...query,
      res,
    })
  }

  /**
   * Retrieves the image for a country flag based on the provided code and query parameters.
   */
  async getFlag({
    code,
    res,
    ...query
  }: { code: string; res: NuvixRes } & CodesQuerDTO) {
    return this.avatarCallback({
      type: 'flags',
      code,
      ...query,
      res,
    })
  }

  /**
   * Retrieves the favicon image for a given URL.
   */
  async getFavicon({ url, res }: { url: string; res: NuvixRes }) {
    try {
      const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`
      const response = await fetch(faviconUrl)
      if (!response.ok) {
        throw new Exception(
          Exception.AVATAR_REMOTE_URL_FAILED,
          'Favicon not found',
        )
      }
      const buffer = await response.arrayBuffer()
      res.header('Content-Type', 'image/png')
      return new StreamableFile(Buffer.from(buffer))
    } catch (error) {
      throw new Exception(
        Exception.AVATAR_REMOTE_URL_FAILED,
        'Failed to fetch favicon',
      )
    }
  }

  private getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      return 'NA'
    }
    const first = Array.from(words[0]!)[0]?.toUpperCase() ?? 'N'
    const second =
      words.length > 1
        ? Array.from(words[1]!)[0]?.toUpperCase()
        : Array.from(words[0]!)[1]?.toUpperCase()
    return (first + (second ?? '')).slice(0, 2)
  }

  private generateCacheKey(
    name: string,
    width: number,
    height: number,
    background: string,
    circle: boolean,
    quality: number,
  ): string {
    return crypto
      .createHash('md5')
      .update(`${name}-${width}-${height}-${background}-${circle}-${quality}`)
      .digest('hex')
  }

  private cache: Record<string, Buffer> = {}

  private getCachedImage(key: string): Buffer | null {
    return this.cache[key] || null
  }

  private cacheImage(key: string, image: Buffer): void {
    this.cache[key] = image
  }

  private hashFnv1a(str: string): number {
    let hash = 2166136261
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i)
      hash +=
        (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
    }
    return hash >>> 0 // Ensure unsigned integer
  }

  private getHSLColorFromName(name: string): string {
    const hash = this.hashFnv1a(name)
    const hue = hash % 360
    const saturation = 65
    const lightness = 55
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }

  async avatarCallback({
    type,
    code,
    width,
    height,
    quality,
    res,
  }: {
    type: 'flags' | 'browsers' | 'credit-cards'
    code: string
    width: number
    height: number
    quality: number
    res: NuvixRes
  }) {
    code = code.toLowerCase()
    let set: Record<string, { name: string; path: string }> = {}
    switch (type) {
      case 'browsers':
        set = browserCodes
        break
      case 'flags':
        set = flags
        break
      case 'credit-cards':
        set = creditCards
        break
      default:
        throw new Exception(Exception.AVATAR_SET_NOT_FOUND)
    }

    if (!(code in set)) {
      throw new Exception(Exception.AVATAR_NOT_FOUND)
    }

    const filePath = set[code]?.path as string

    const fileBuffer = await fs.readFile(filePath).catch(() => {
      throw new Exception(Exception.AVATAR_NOT_FOUND)
    })
    const processedImage = await sharp(fileBuffer)
      .resize(width, height)
      .png({ quality })
      .toBuffer()

    res.header('Cache-Control', 'private, max-age=2592000') // 30 days
    res.header('Content-Type', 'image/png')
    return new StreamableFile(processedImage)
  }
}
