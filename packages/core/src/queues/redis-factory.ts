/**
 * Points BullMQ's global client factory at Bun's built-in RedisClient.
 *
 * BullMQ's default client is ioredis; with the factory set, every connection
 * BullMQ creates — Queue, Worker, QueueEvents, blocking duplicates — is a Bun
 * `RedisClient` wrapped in BullMQ's own `createBunRedisClient` adapter, and
 * ioredis is never loaded. Existing `connection: { host, port, … }` call sites
 * keep working unchanged: the factory receives the merged connection options
 * BullMQ would normally hand to ioredis.
 *
 * Idempotent. Lazily requires bullmq so in-memory/test code paths and the AOT
 * dry-run never touch it (or msgpackr's native addon).
 */
import { RedisClient } from 'bun'

let configured = false

export function useBunRedisClients(): void {
  if (configured) return
  configured = true

  const { RedisConnection, createBunRedisClient } = require('bullmq') as {
    RedisConnection: {
      clientFactory?: (opts: Record<string, unknown>) => unknown
    }
    createBunRedisClient: (client: unknown) => unknown
  }

  RedisConnection.clientFactory = (opts) => {
    const host = typeof opts.host === 'string' && opts.host ? opts.host : 'localhost'
    const port = typeof opts.port === 'number' ? opts.port : 6379
    // ioredis auth conventions: username `default` means password-only auth.
    const username = typeof opts.username === 'string' ? opts.username : undefined
    const password = typeof opts.password === 'string' ? opts.password : undefined
    const auth =
      username && username !== 'default'
        ? `${encodeURIComponent(username)}:${encodeURIComponent(password ?? '')}@`
        : password
          ? `:${encodeURIComponent(password)}@`
          : ''
    const db = typeof opts.db === 'number' && opts.db > 0 ? `/${opts.db}` : ''
    const raw = new RedisClient(`redis://${auth}${host}:${port}${db}`)
    return createBunRedisClient(raw)
  }
}
