import { config } from '@nuvix/utils'
import { app } from './app'

const server = Bun.serve({
  port: config.platform.port,
  hostname: config.platform.host,
  fetch: app.fetch,
})

console.log(
  `[nuvix] platform API listening on http://${server.hostname}:${server.port} (${config.env})`,
)
