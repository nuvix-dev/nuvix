import { config } from '@nuvix/utils'
import { app, queues } from './app'
import { createQueueWorkers, parseRedisUrl } from './workers'

const server = Bun.serve({
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
})

// Queue workers run in-process (main thread) alongside the API — the audit
// batcher buffers writes so the request path never blocks on persistence.
let workers: ReturnType<typeof createQueueWorkers> | undefined
if (!config.isTest) {
  // Fail fast outside tests when the queue backend is not configured.
  const redisUrl = config.redisUrl
  workers = createQueueWorkers(parseRedisUrl(redisUrl))
}

console.log(`[nuvix] v2 API listening on http://${server.hostname}:${server.port} (${config.env})`)

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
