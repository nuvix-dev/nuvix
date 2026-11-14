import { Cache, Memory, Redis } from '@nuvix/cache'
import { RedisClient } from 'bun'

/**
 * Resolves the tenant document-cache backend exactly once per process —
 * never per request, never per tenant access. When a Redis URL is
 * configured, every tenant's `Cache` shares the same underlying
 * `RedisClient` connection; tenants are isolated purely by a per-tenant
 * key namespace (`Redis`'s `namespace` option). Constructing a namespaced
 * wrapper is a cheap, connection-free object creation, so `forTenant` is
 * safe to call on every `TenantResource` construction without adding I/O.
 * With no Redis URL configured, every tenant gets its own in-memory cache
 * instead (dev/test default, zero external dependencies).
 */
export interface TenantCacheFactory {
  forTenant(namespace: string): Cache
  close(): Promise<void>
}

/** Construction options for the shared cache factory. */
export interface TenantCacheFactoryOptions {
  /** Omit to use an in-memory cache per tenant instead of Redis. */
  redisUrl?: string
}

/** One process-wide factory; the optional Redis client is owned and closed by it. */
export function createTenantCacheFactory(
  options: TenantCacheFactoryOptions = {},
): TenantCacheFactory {
  const client = options.redisUrl ? new RedisClient(options.redisUrl) : undefined

  return {
    forTenant(namespace: string): Cache {
      if (!client) return new Cache(new Memory())
      return new Cache(new Redis({ client, namespace }))
    },
    async close(): Promise<void> {
      client?.close()
    },
  }
}
