import { Injectable } from '@nestjs/common'
import { CoreService } from './core.service'
import { Redis } from 'ioredis'

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

export interface RateLimitOptions {
  limit: number // max requests allowed
  window: number // duration in seconds
}

@Injectable()
export class RatelimitService {
  private redisClient: Redis

  constructor(private readonly coreService: CoreService) {
    this.redisClient = this.coreService.createCacheDb()
  }

  /**
   * Internal unified rate limit logic.
   * @param key - base identifier (e.g. project:user:route)
   * @param options - limit configuration
   * @param increment - how much to increment (0 = just check)
   */
  private async processRateLimit(
    key: string,
    options: RateLimitOptions,
    increment: number,
  ): Promise<RateLimitResult> {
    const { limit, window } = options
    const now = Date.now()
    const bucket = Math.floor(now / (window * 1000))
    const redisKey = `rl:${key}:${window}:${bucket}`

    try {
      let count: number

      if (increment > 0) {
        // Increment atomically
        count = await this.redisClient.incrby(redisKey, increment)

        // First write → set TTL
        if (count === increment) {
          await this.redisClient.expire(redisKey, window)
        }
      } else {
        // Just read current value
        const raw = await this.redisClient.get(redisKey)
        count = raw ? parseInt(raw, 10) : 0
      }

      // Get remaining TTL for reset time
      const ttl = await this.redisClient.ttl(redisKey)
      const resetTime = ttl > 0 ? now + ttl * 1000 : now + window * 1000

      const remaining = Math.max(0, limit - count)
      const allowed = count <= limit

      return {
        allowed,
        limit,
        remaining,
        resetTime,
        retryAfter: allowed ? undefined : ttl,
      }
    } catch {
      // Fail open on Redis errors
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetTime: Date.now() + window * 1000,
      }
    }
  }

  /**
   * Check & increment rate limit counter.
   */
  public async checkRateLimit(
    key: string,
    options: RateLimitOptions,
  ): Promise<RateLimitResult> {
    return this.processRateLimit(key, options, 1)
  }

  /**
   * Only check status without incrementing.
   */
  public async getRateLimitStatus(
    key: string,
    options: RateLimitOptions,
  ): Promise<RateLimitResult> {
    return this.processRateLimit(key, options, 0)
  }

  /**
   * Increment manually (e.g. from onResponse hook).
   */
  public async incrementRateLimit(
    key: string,
    options: RateLimitOptions,
    increment = 1,
  ): Promise<RateLimitResult> {
    return this.processRateLimit(key, options, increment)
  }

  /**
   * Simple boolean check.
   */
  public async isRateLimited(
    key: string,
    limit: number,
    duration: number,
  ): Promise<boolean> {
    const result = await this.checkRateLimit(key, { limit, window: duration })
    return !result.allowed
  }

  /**
   * Reset a subject's rate limits by deleting all buckets.
   */
  public async resetRateLimit(key: string): Promise<void> {
    const pattern = `rl:${key}:*`
    const keys = await this.redisClient.keys(pattern)
    if (keys.length > 0) {
      await this.redisClient.del(...keys)
    }
  }
}
