/**
 * Logs worker — Bun-native port of legacy `ApiLogsQueue`
 * (AbstractBatchQueue): buffers incoming API-log events per tenant and
 * flushes them to the tenant's `api_logs` collection (auth schema) in
 * batches, with v1's deep recursive redaction over the metadata
 * (headers/query/mode/session type/user).
 *
 * Logs are per-project data — they live in EACH project's tenant
 * database (v1 stored them in the platform main pool's `system` schema
 * because v1 was not truly multi-tenant). Job payloads carry
 * `projectId`; the worker resolves the tenant through the platform
 * registry + tenant pool (D20/D41).
 *
 * The request-path SOURCE lives in `../logs/source.ts` (v1 `LogsHook`
 * parity). Logs are lossy by design: persistence failures are
 * swallowed after logging (they must never break delivery of anything
 * else); a tenant provisioned before the `api_logs` collection existed
 * logs a one-time warning until re-provisioned.
 */

import type { LogJobData } from '@nuvix/core/queues'
import { Doc, type Session } from '@nuvix/db'
import type { Job } from 'bullmq'

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-nuvix-signature',
  'x-nuvix-timestamp',
  'x-nuvix-nonce',
  'secret',
  'token',
  'apikey',
  'x-nuvix-key',
  'x-nuvix-session',
  'x-nuvix-jwt',
])

/** v1 `ApiLog` wire shape + tenant resolution field. */
export type ApiLogJobData = LogJobData

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  if (SENSITIVE_KEYS.has(lower)) return true
  return (
    lower.includes('token') ||
    lower.includes('secret') ||
    lower.includes('key') ||
    lower.includes('password') ||
    lower.includes('auth')
  )
}

/** Deep recursive redaction for metadata (v1 `redact` parity). */
export function redact(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data
  if (Array.isArray(data)) return data.map((v) => redact(v))

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      out[key] = '[REDACTED]'
    } else if (value && typeof value === 'object') {
      out[key] = redact(value)
    } else {
      out[key] = value
    }
  }
  return out
}

// ── Batch buffer (module-level: one per worker thread) ──────────────────────

const BATCH_SIZE = 5000
const BATCH_INTERVAL_MS = 3000

const buffer: ApiLogJobData[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

/** Injectable persistence boundary (tests stub this; prod resolves tenants). */
export type LogsPersister = (projectId: string, rows: ApiLogJobData[]) => Promise<void>

let persister: LogsPersister = defaultPersist

/** Overrides the persistence boundary (tests). */
export function setLogsPersister(custom: LogsPersister): void {
  persister = custom
}

let defaultResolverPromise: Promise<(projectId: string) => Promise<Session>> | undefined

/** Memoized platform registry + tenant pool (per worker thread). */
async function resolveSession(projectId: string): Promise<Session> {
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
          throw new Error(`[logs] unknown project: ${pid}`)
        }
        const resource = await pool.get(resolved)
        return resource.authSystemSession()
      }
    })()
  }
  return (await defaultResolverPromise)(projectId)
}

async function defaultPersist(projectId: string, rows: ApiLogJobData[]): Promise<void> {
  const session = await resolveSession(projectId)
  const docs = rows.map(
    (row) =>
      new Doc({
        request_id: row.request_id,
        method: row.method,
        path: row.path,
        status: row.status,
        timestamp: row.timestamp,
        client_ip: row.client_ip ?? null,
        user_agent: row.user_agent ?? null,
        resource: row.resource ?? null,
        latency_ms: row.latency_ms ?? null,
        region: row.region ?? null,
        error: row.error ?? null,
        metadata: row.metadata ?? null,
      }),
  )
  await session.createDocuments('api_logs', docs)
}

async function flush(): Promise<void> {
  flushTimer = null
  if (buffer.length === 0) return

  const batch = buffer.splice(0, buffer.length)
  // Group by tenant so each write batch hits one connection.
  const byProject = new Map<string, ApiLogJobData[]>()
  for (const row of batch) {
    const list = byProject.get(row.projectId) ?? []
    list.push(row)
    byProject.set(row.projectId, list)
  }

  for (const [projectId, rows] of byProject) {
    try {
      await persister(projectId, rows)
    } catch (error) {
      // Logs are lossy by design — never break the worker loop; drop the
      // batch after reporting (v1 queued failures were silent, too).
      console.error('[logs] flush failed, batch dropped', error)
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
export default async function processLogs(
  job: Job<ApiLogJobData>,
): Promise<{ success: boolean; buffered: number }> {
  // Deep redaction happens at buffer time so the in-memory buffer and
  // every persistence boundary downstream only ever see redacted rows.
  buffer.push({
    ...job.data,
    metadata: redact(job.data.metadata) as Record<string, unknown> | undefined,
  })
  if (buffer.length >= BATCH_SIZE) {
    await flush()
    return { success: true, buffered: 0 }
  }
  scheduleFlush()
  return { success: true, buffered: buffer.length }
}

/** Test/production helper: force-flush the buffer. */
export async function flushLogs(): Promise<void> {
  await flush()
}
