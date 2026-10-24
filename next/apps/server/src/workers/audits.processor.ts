/**
 * Audits worker — Bun-native port of legacy `AuditsQueue`
 * (AbstractBatchQueue): buffers incoming audit events per tenant and
 * flushes them to the tenant's `audit` collection in batches
 * (5000 items / 3s — legacy `configuration.limits.batchSize`).
 *
 * Job payloads carry `projectId`; the worker resolves the tenant
 * connection through the platform registry + tenant pool (D20/D41).
 */

import type { Job } from 'bullmq'

export interface AuditJobData {
  event: string
  /** Platform project id — resolves the tenant database. */
  projectId?: string
  /** Internal user sequence (`-1` for guests/system actors). */
  userSequence?: number
  /** Public user id. */
  userId?: string
  userName?: string
  userEmail?: string
  userType?: string
  mode?: string
  resource?: string
  ip?: string
  userAgent?: string
  data?: Record<string, unknown>
}

/** One normalized audit row ready for persistence. */
export interface AuditRow {
  projectId: string
  entry: {
    userId: number
    event: string
    resource: string
    userAgent: string
    ip: string
    location: string
    time: Date
    data: Record<string, unknown>
  }
}

/** Maps a queue job payload to a normalized audit row (v1 buildItem parity). */
export function toAuditRow(data: AuditJobData): AuditRow {
  return {
    projectId: data.projectId ?? '',
    entry: {
      userId: data.userSequence ?? -1,
      event: data.event,
      resource: data.resource ?? '',
      userAgent: data.userAgent ?? '',
      ip: data.ip ?? '',
      location: '',
      time: new Date(),
      data: {
        userId: data.userId ?? '',
        userName: data.userName ?? '',
        userEmail: data.userEmail ?? '',
        userType: data.userType ?? '',
        mode: data.mode ?? '',
        data: data.data ?? {},
      },
    },
  }
}

// ── Batch buffer (module-level: one per worker thread) ──────────────────────

const BATCH_SIZE = 5000
const BATCH_INTERVAL_MS = 3000

const buffer: AuditRow[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

/** Injectable persistence boundary (tests stub this; prod resolves tenants). */
export type AuditPersister = (rows: AuditRow[]) => Promise<void>

let persister: AuditPersister = defaultPersist

/** Overrides the persistence boundary (tests). */
export function setAuditPersister(custom: AuditPersister): void {
  persister = custom
}

async function defaultPersist(rows: AuditRow[]): Promise<void> {
  // Rows arrive grouped by project (flush() groups them).
  const projectId = rows[0]?.projectId
  if (!projectId) return

  // Lazily wired per worker thread: platform registry + tenant pool.
  const { createPlatformDatabase, ProjectRegistry } = await import('@nuvix/core/platform')
  const { TenantResourcePool } = await import('@nuvix/core/tenants')
  const { AuditService } = await import('@nuvix/core/audit')
  const { config } = await import('@nuvix/utils')

  const platformDb = await createPlatformDatabase({
    driver: config.platform.dbDriver,
    url: config.platform.dbUrl,
    encryptionKey: config.platform.tenantEncryptionKey,
  })
  const registry = new ProjectRegistry(platformDb)
  const pool = new TenantResourcePool()

  const resolved = await registry.getProjectTarget(projectId)
  if (!resolved) {
    throw new Error(`[audits] unknown project: ${projectId}`)
  }
  const resource = await pool.get(resolved)
  const audit = new AuditService(resource.authSystemSession())
  await audit.logBatch(rows.map((row) => row.entry))
}

async function flush(): Promise<void> {
  flushTimer = null
  if (buffer.length === 0) return

  const batch = buffer.splice(0, buffer.length)
  // Group by tenant so each write batch hits one connection.
  const byProject = new Map<string, AuditRow[]>()
  for (const row of batch) {
    const list = byProject.get(row.projectId) ?? []
    list.push(row)
    byProject.set(row.projectId, list)
  }

  for (const rows of byProject.values()) {
    try {
      await persister(rows)
    } catch (error) {
      // Never lose the flush loop over a single tenant failure — requeue
      // the rows at the front of the buffer (bounded by BATCH_SIZE).
      buffer.unshift(...rows)
      console.error('[audits] flush failed, requeued', error)
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
export default async function processAudits(
  job: Job<AuditJobData>,
): Promise<{ success: boolean; buffered: number }> {
  buffer.push(toAuditRow(job.data))
  if (buffer.length >= BATCH_SIZE) {
    await flush()
    return { success: true, buffered: 0 }
  }
  scheduleFlush()
  return { success: true, buffered: buffer.length }
}

/** Test/production helper: force-flush the buffer. */
export async function flushAudits(): Promise<void> {
  await flush()
}
