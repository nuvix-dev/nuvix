import { Injectable, Logger } from '@nestjs/common'
import { createCanvas, registerFont } from 'canvas'
import sharp from 'sharp'
import crypto from 'crypto'
import { default as path } from 'path'

import { PROJECT_ROOT } from '@nuvix/utils'
import fs from 'fs'

@Injectable()
export class AvatarsService {
  private readonly logger = new Logger(AvatarsService.name)

  constructor() {
    try {
      const fontPath = path.join(
        PROJECT_ROOT,
        'assets/fonts',
        'Varela-Regular.ttf',
      )

      // Check if font file exists before registering
      if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family: 'Varela' })
        this.logger.log(`Font registered from: ${fontPath}`)
      } else {
        this.logger.warn(`Font file not found at: ${fontPath}`)
      }
    } catch (error: any) {
      this.logger.error(`Error registering font: ${error.message}`)
    }
  }

  async generateAvatar({
    name,
    width = 100,
    height = 100,
    background,
    circle,
    res,
  }: {
    name: string
    width: number | string
    height: number | string
    background: string
    circle: boolean | string
    res: NuvixRes
  }) {
    try {
      const MAX_DIM = 1024
      const MIN_DIM = 16
      const toNum = (v: number | string, fallback: number) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : fallback
      }
      width = Math.min(MAX_DIM, Math.max(MIN_DIM, toNum(width, 100)))
      height = Math.min(MAX_DIM, Math.max(MIN_DIM, toNum(height, 100)))
      circle = circle === true || circle === 'true' // Handle boolean query
      // Sanitize hex; fallback to deterministic HSL if invalid length
      if (background) {
        const hex = background.replace(/[^0-9a-fA-F]/g, '')
        background =
          hex.length === 3 || hex.length === 6
            ? `#${hex}`
            : this.getHSLColorFromName(name)
      } else {
        background = this.getHSLColorFromName(name)
      }

      const cacheKey = this.generateCacheKey(
        name,
        width,
        height,
        background,
        circle,
      )
      const cachedImage = this.getCachedImage(cacheKey)
      if (cachedImage) {
        res.header('Content-Type', 'image/png')
        return res.send(cachedImage)
      }

      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')

      // Draw Background (circle or rectangle)
      if (circle) {
        ctx.beginPath()
        ctx.arc(
          width / 2,
          height / 2,
          Math.min(width, height) / 2,
          0,
          Math.PI * 2,
        )
        ctx.fillStyle = background
        ctx.fill()
      } else {
        ctx.fillStyle = background
        ctx.fillRect(0, 0, width, height)
      }

      // Draw Text
      ctx.fillStyle = '#ffffff'
      ctx.font = `${Math.min(width, height) / 2}px Varela`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(this.getInitials(name), width / 2, height / 2)

      // Convert Canvas to PNG Buffer
      const buffer = canvas.toBuffer('image/png')

      // Process Image with Sharp (for better output)
      const processedImage = await sharp(buffer)
        .resize(width, height)
        .png()
        .toBuffer()

      // Store in cache
      this.cacheImage(cacheKey, processedImage)

      // Send Image Response
      res.header('Content-Type', 'image/png')
      res.send(processedImage)
    } catch (error) {
      console.error('Error generating avatar:', error)
      res.status(500).send('Error generating avatar')
    }
  }

  private getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return 'NA'
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
  ): string {
    return crypto
      .createHash('md5')
      .update(`${name}-${width}-${height}-${background}-${circle}`)
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
}
