/**
 * Stats worker: buffers incoming metric batches per tenant and flushes
 * them to the tenant `stats` collection (auth schema) in batches,
 * aggregated per metric key and persisted across periods (inf/1h/1d)
 * with deterministic `fnv1a128` ids via create-or-update-with-increase.
 *
 * Metric SOURCES live in `../stats/source.ts` (request-path network
 * metrics + tenant document-event listeners); job payloads carry
 * `projectId` and the worker resolves the tenant through the platform
 * registry and tenant pool.
 *
 * No separate reduce/compensation path exists: file/session deletes
 * row-by-row, and their DocumentDelete events decrement the metrics
 * naturally.
 */

import { Doc, type Session } from '@nuvix/db'
import { fnv1a128, MetricPeriod } from '@nuvix/utils'
import type { Job } from 'bullmq'

export interface StatsJobData {
  /** Platform project id — resolves the tenant database (auth schema). */
  projectId: string
  /** One job carries the metrics of a single event. */
  metrics: Array<{ key: string; value: number }>
}

// ── Batch buffer (module-level: one per worker thread) ──────────────────────

const BATCH_SIZE = 5000
const BATCH_INTERVAL_MS = 3000

const buffer: StatsJobData[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

/** Injectable persistence boundary (tests stub this; prod resolves tenants). */
export type StatsPersister = (
  projectId: string,
  metrics: Array<{ key: string; value: number }>,
) => Promise<void>

let persister: StatsPersister = defaultPersist

/** Overrides the persistence boundary (tests). */
export function setStatsPersister(custom: StatsPersister): void {
  persister = custom
}

/** Tenant auth-system session resolver boundary (overridable in tests). */
export type StatsSessionResolver = (projectId: string) => Promise<Session>

let sessionResolver: StatsSessionResolver = defaultResolveSession

/** Overrides the tenant-session resolver (tests). */
export function setStatsSessionResolver(custom: StatsSessionResolver): void {
  sessionResolver = custom
}

let defaultResolverPromise: Promise<StatsSessionResolver> | undefined

/** Memoized platform registry + tenant pool (per worker thread). */
async function defaultResolveSession(projectId: string): Promise<Session> {
  if (!defaultResolverPromise) {
    defaultResolverPromise = (async () => {
      const { createPlatformDatabase, ProjectRegistry } = await import('@nuvix/core/platform')
      const { TenantResourcePool } = await import('@nuvix/core/tenants')
      const { config } = await import('@nuvix/utils')
      const platformDb = await createPlatformDatabase({
        driver: config.platform.dbDriver,
        url: config.platform.dbUrl,
        encryptionKey: config.platform.tenantEncryptionKey,
      })
      const registry = new ProjectRegistry(platformDb)
      const pool = new TenantResourcePool()
      return async (pid: string): Promise<Session> => {
        const resolved = await registry.getProjectTarget(pid)
        if (!resolved) {
          throw new Error(`[stats] unknown project: ${pid}`)
        }
        const resource = await pool.get(resolved)
        return resource.authSystemSession()
      }
    })()
  }
  return (await defaultResolverPromise)(projectId)
}

async function defaultPersist(
  projectId: string,
  metrics: Array<{ key: string; value: number }>,
): Promise<void> {
  const session = await sessionResolver(projectId)
  await persistStats(session, metrics)
}

/**
 * Aggregates metric batches and persists one `stats` row per
 * (period, metric) with the deterministic id — values accumulate via
 * create-or-update-with-increase.
 */
export async function persistStats(
  session: Session,
  metrics: Array<{ key: string; value: number }>,
): Promise<void> {
  const accumulator = new Map<string, number>()
  for (const { key, value } of metrics) {
    accumulator.set(key, (accumulator.get(key) ?? 0) + value)
  }

  const receivedAt = new Date()
  const docs: Doc<Record<string, unknown>>[] = []

  for (const [key, value] of accumulator) {
    if (value === 0) continue

    for (const period of [MetricPeriod.INF, MetricPeriod.HOUR, MetricPeriod.DAY] as const) {
      const time = formatPeriodDate(period, receivedAt)
      docs.push(
        new Doc({
          $id: fnv1a128(`${time}|${period}|${key}`),
          time: time === 'inf' ? null : time,
          period,
          metric: key,
          value,
          region: 'local',
        }),
      )
    }
  }

  if (docs.length === 0) return
  await session.createOrUpdateDocumentsWithIncrease('stats', 'value', docs)
}

/** Bucket key for a period: INF has no time bucket. */
export function formatPeriodDate(period: MetricPeriod, date: Date): string {
  switch (period) {
    case MetricPeriod.INF:
      return 'inf'
    case MetricPeriod.HOUR:
      return `${date.toISOString().slice(0, 13)}:00:00Z`
    case MetricPeriod.DAY:
      return `${date.toISOString().slice(0, 10)}T00:00:00Z`
    default:
      throw new Error(`Unsupported period: ${period}`)
  }
}

async function flush(): Promise<void> {
  flushTimer = null
  if (buffer.length === 0) return

  const batch = buffer.splice(0, buffer.length)
  // Aggregate per tenant, then per metric.
  const byProject = new Map<string, Array<{ key: string; value: number }>>()
  for (const job of batch) {
    const list = byProject.get(job.projectId) ?? []
    list.push(...(job.metrics ?? []))
    byProject.set(job.projectId, list)
  }

  for (const [projectId, metrics] of byProject) {
    try {
      await persister(projectId, metrics)
    } catch (error) {
      // Never lose the flush loop over a single tenant failure — requeue
      // the job at the front of the buffer (bounded by BATCH_SIZE).
      buffer.unshift({ projectId, metrics })
      console.error('[stats] flush failed, requeued', error)
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    void flush()
  }, BATCH_INTERVAL_MS)
}

/** Entry point wired in `workers/index.ts`. */
export default async function processStats(
  job: Job<StatsJobData>,
): Promise<{ success: boolean; buffered: number }> {
  buffer.push({ projectId: job.data.projectId, metrics: job.data.metrics })
  if (buffer.length >= BATCH_SIZE) {
    await flush()
    return { success: true, buffered: 0 }
  }
  scheduleFlush()
  return { success: true, buffered: buffer.length }
}

/** Test/production helper: force-flush the buffer. */
export async function flushStats(): Promise<void> {
  await flush()
}
