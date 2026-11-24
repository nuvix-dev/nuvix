/** Executable entry point: Bun server, in-process queue workers, graceful shutdown. */

import { parseRedisUrl } from '@nuvix/core/queues'
import { config } from '@nuvix/utils'
import { inAotBuild } from 'elysia'
import { app, queues } from './app'

// Exported for the AOT bundler: the build dry-runs this entry to capture
// route registration and compile the route manifests (see build.ts).
export { app }

if (!inAotBuild()) {
  const server = Bun.serve({
    port: config.platform.port,
    hostname: config.platform.host,
    fetch: app.fetch,
  })

  // PROJECTS worker runs in-process alongside the API (background tenant
  // provisioning). Redis is required outside tests when background
  // provisioning is enabled; without it the app falls back to inline
  // provisioning and no worker starts. Loaded lazily so the AOT dry-run
  // never touches bullmq/native addons.
  let workers: { close(): Promise<void> } | undefined
  if (!config.isTest && Bun.env.NUVIX_REDIS_URL) {
    const { createPlatformQueueWorkers } = await import('./workers')
    workers = createPlatformQueueWorkers(parseRedisUrl(Bun.env.NUVIX_REDIS_URL))
  }

  console.log(
    `[nuvix] platform API listening on http://${server.hostname}:${server.port} (${config.env})`,
  )

  /** Close workers, queues, and the HTTP server, then exit. */
  async function shutdown(signal: string) {
    console.log(`[nuvix] ${signal} received — shutting down`)
    try {
      await Promise.allSettled([workers?.close(), queues.close(), app.stop(true)])
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}
