/**
 * Performance baseline benchmark for Nuvix v2 (Bun-native runtime).
 * Measures throughput (req/s) and latency distribution (p50, p95, p99)
 * across key core API pathways using real app.handle().
 */
export {}

process.env.NUVIX_INTERNAL_DATABASE_URL ??= 'postgres://localhost:5432/nuvix'
process.env.NUVIX_JWT_SECRET ??= 'bench-secret-key-32-chars-long!!'
process.env.NUVIX_REDIS_URL ??= 'redis://localhost:6379'
process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

const startImport = performance.now()
const { app } = await import('../../apps/server/src/app')
const importTimeMs = performance.now() - startImport

interface BenchResult {
  name: string
  iterations: number
  totalMs: number
  reqPerSec: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
}

async function benchmark(
  name: string,
  requestFactory: () => Request,
  warmup = 100,
  iterations = 2000,
): Promise<BenchResult> {
  // Warmup
  for (let i = 0; i < warmup; i++) {
    await app.handle(requestFactory())
  }

  // Measurement
  const latencies: number[] = new Array(iterations)
  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    await app.handle(requestFactory())
    latencies[i] = performance.now() - t0
  }

  const totalMs = performance.now() - start
  latencies.sort((a, b) => a - b)

  const p50 = latencies[Math.floor(iterations * 0.5)] ?? 0
  const p95 = latencies[Math.floor(iterations * 0.95)] ?? 0
  const p99 = latencies[Math.floor(iterations * 0.99)] ?? 0

  return {
    name,
    iterations,
    totalMs,
    reqPerSec: Math.round((iterations / totalMs) * 1000),
    p50Ms: Number(p50.toFixed(3)),
    p95Ms: Number(p95.toFixed(3)),
    p99Ms: Number(p99.toFixed(3)),
  }
}

console.log('='.repeat(70))
console.log(`Nuvix v2 Performance Baseline (Bun ${Bun.version})`)
console.log(`App startup & module resolution time: ${importTimeMs.toFixed(2)}ms`)
console.log('='.repeat(70))

const suites = [
  {
    name: 'GET /v2/health (JSON response)',
    factory: () => new Request('http://localhost/v2/health'),
  },
  {
    name: 'GET /v2/whoami (Context chain: auth + project)',
    factory: () => new Request('http://localhost/v2/whoami'),
  },
  {
    name: 'GET /v2/locale (GeoIP + ICU translation)',
    factory: () =>
      new Request('http://localhost/v2/locale', {
        headers: { 'x-forwarded-for': '8.8.8.8' },
      }),
  },
  {
    name: 'GET /v2/avatars/initials (SVG + Resvg render)',
    factory: () => new Request('http://localhost/v2/avatars/initials?name=Ada+Lovelace'),
  },
  {
    name: 'GET /v2/does-not-exist (RFC-9457 error pipeline)',
    factory: () => new Request('http://localhost/v2/does-not-exist'),
  },
]

for (const suite of suites) {
  const result = await benchmark(suite.name, suite.factory)
  console.log(`\n• ${result.name}:`)
  console.log(`  Throughput: ${result.reqPerSec.toLocaleString()} req/s`)
  console.log(`  Latency: p50=${result.p50Ms}ms | p95=${result.p95Ms}ms | p99=${result.p99Ms}ms`)
}

console.log(`\n${'='.repeat(70)}`)
