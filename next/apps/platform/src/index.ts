import { parseRedisUrl } from '@nuvix/core/queues'
import { config } from '@nuvix/utils'
import { app, queues } from './app'
import { createPlatformQueueWorkers } from './workers'

const server = Bun.serve({
  port: config.platform.port,
  hostname: config.platform.host,
  fetch: app.fetch,
})

// PROJECTS worker runs in-process alongside the API (background tenant
// provisioning). Redis is required outside tests when background
// provisioning is enabled; without it the app falls back to inline
// provisioning and no worker starts.
let workers: ReturnType<typeof createPlatformQueueWorkers> | undefined
if (!config.isTest && Bun.env.NUVIX_REDIS_URL) {
  workers = createPlatformQueueWorkers(parseRedisUrl(Bun.env.NUVIX_REDIS_URL))
}

console.log(
  `[nuvix] platform API listening on http://${server.hostname}:${server.port} (${config.env})`,
)

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
