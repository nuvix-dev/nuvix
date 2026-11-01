/**
 * Ahead-of-time build for the deployable apps (see docs/deployment.md and
 * https://next.elysiajs.com/patterns/aot/).
 *
 * Dry-runs the selected app's entry to capture route registration, then
 * compiles every route handler into a bundle. Route compilation moves from
 * the first request (JIT) to the build step — faster startup, lower peak
 * memory, and TypeBox drops out of the runtime when no schema needs it.
 *
 * Usage: APP_NAME=server|platform bun run build.ts   (defaults to server)
 * Output: apps/<APP_NAME>/dist/index.js — run with `bun apps/<APP>/dist/index.js`.
 */
import { aot } from 'elysia/plugin/aot/bun'

const appName = process.env.APP_NAME ?? 'server'
if (appName !== 'server' && appName !== 'platform') {
  throw new Error(`[aot] unknown APP_NAME "${appName}" (expected "server" or "platform")`)
}

// Build-time environment for the dry-run: the app module is executed to
// capture route registration, so config-time requirements must be satisfied
// without provisioning anything real. Handlers never run, infrastructure is
// guarded by `inAotBuild()`, and queues degrade to in-memory without Redis.
process.env.NUVIX_JWT_SECRET ??= 'aot-build-only-not-a-secret'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='
process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'

const entry = `apps/${appName}/src/index.ts`
const outdir = `apps/${appName}/dist`

const result = await Bun.build({
  entrypoints: [entry],
  outdir,
  target: 'bun',
  // Splitting keeps dynamic imports (the bullmq workers chunk) LAZY at
  // runtime — without it Bun inlines them and their top-level imports
  // (the native msgpackr addon) execute at bundle load.
  splitting: true,
  plugins: [aot(entry, { target: 'bun' })],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

console.log(`[aot] ${appName} compiled → ${outdir}`)
