/**
 * Usage metrics sources: request-path network metrics and tenant
 * document-event metrics.
 *
 * Document events: the composition wires every tenant `Database`
 * through `wireStatsDatabase`, which registers `calculate-usage`
 * listeners and enqueues metric batches — users, teams, sessions,
 * buckets, files (+ storage bytes). Session and file deletes fire
 * DocumentDelete events, so the aggregate metrics decrement there
 * without a separate reduce path.
 */

import { type Database, type Doc, Events } from '@nuvix/db'
import { MetricFor } from '@nuvix/utils'
import type { Elysia } from 'elysia'

/** Queue boundary — app composition supplies the QueueManager enqueuer. */
export type StatsEnqueuer = (
  projectId: string,
  metrics: Array<{ key: string; value: number }>,
) => Promise<void>

/**
 * Registers `calculate-usage` document-event listeners on a tenant
 * database. Events must never break request paths — the enqueue side
 * is fire-and-forget.
 */
export function wireStatsDatabase(deps: {
  projectId: string
  database: Database
  enqueue: StatsEnqueuer
}): void {
  const { projectId, database, enqueue } = deps

  const emit = (metrics: Array<{ key: string; value: number }>): void => {
    if (metrics.length === 0) return
    void enqueue(projectId, metrics).catch(() => {
      // Stats emission must never break the request path.
    })
  }

  database.on(Events.DocumentCreate, 'calculate-usage', (document: Doc) => {
    emit(documentMetrics(document, 1))
  })
  database.on(Events.DocumentDelete, 'calculate-usage', (document: Doc) => {
    emit(documentMetrics(document, -1))
  })
  database.on(Events.DocumentsCreate, 'calculate-usage', (documents: Doc[] | Doc) => {
    const count = Array.isArray(documents) ? documents.length : 1
    if (count > 0) emit(collectionMetrics(collectionOf(documents), count))
  })
  database.on(
    Events.DocumentsDelete,
    'calculate-usage',
    (documents: Doc[] | Doc<{ $collection: string; modified: number }>) => {
      const count = Array.isArray(documents) ? documents.length : 1
      if (count > 0) emit(collectionMetrics(collectionOf(documents), -count))
    },
  )
}

/** Collection id of a document or a document batch (batch upserts carry it). */
function collectionOf(
  documents: Doc[] | Doc<{ $collection: string; modified: number }> | Doc,
): string {
  const first = Array.isArray(documents) ? documents[0] : documents
  return first?.getCollection?.() ?? ''
}

/** Metric keys for one document delta, keyed by the document's collection. */
function documentMetrics(document: Doc, value: number): Array<{ key: string; value: number }> {
  return collectionMetrics(document.getCollection?.() ?? '', value, document)
}

function collectionMetrics(
  collection: string,
  value: number,
  document?: Doc,
): Array<{ key: string; value: number }> {
  switch (collection) {
    case 'teams':
      return [{ key: MetricFor.TEAMS, value }]
    case 'users':
      return [{ key: MetricFor.USERS, value }]
    case 'sessions':
      return [{ key: MetricFor.SESSIONS, value }]
    case 'buckets':
      return [{ key: MetricFor.BUCKETS, value }]
    case 'files': {
      const size = Number(document?.get?.('sizeOriginal') ?? 0) * value
      const metrics: Array<{ key: string; value: number }> = [
        { key: MetricFor.FILES, value },
        { key: MetricFor.FILES_STORAGE, value: size },
      ]
      // Per-bucket breakdown metrics, when the file carries its bucket id.
      const bucketInternalId = document?.get?.('bucketInternalId')
      if (bucketInternalId !== undefined && bucketInternalId !== null) {
        const bucketKey = String(bucketInternalId)
        metrics.push({
          key: MetricFor.BUCKET_ID_FILES.replace('{bucketInternalId}', bucketKey),
          value,
        })
        metrics.push({
          key: MetricFor.BUCKET_ID_FILES_STORAGE.replace('{bucketInternalId}', bucketKey),
          value: size,
        })
      }
      return metrics
    }
    default:
      return []
  }
}

/**
 * Request-path network metrics: request count + inbound/outbound
 * bytes. Skipped for API-key callers (console/platform maintenance
 * traffic, not product usage) and when stats are disabled.
 */
export function statsRequestSource(options: {
  enqueue: StatsEnqueuer
  enabled?: () => boolean
}): (app: Elysia) => Elysia {
  const enabled = options.enabled ?? (() => true)
  // Function-style plugin — registers the hook directly on the consuming
  // instance (same pattern as `rateLimit`).
  return (app: Elysia) =>
    app.afterResponse((raw: unknown): void => {
      try {
        if (!enabled()) return
        const ctx = raw as {
          request?: Request
          /** The handler's mapped return value, not the raw Response. */
          responseValue?: unknown
          project?: unknown
          auth?: unknown
        }
        // API-key callers are maintenance traffic — not product usage.
        if (
          ctx.auth &&
          typeof ctx.auth === 'object' &&
          'type' in ctx.auth &&
          (ctx.auth as { type?: string }).type === 'apiKey'
        ) {
          return
        }
        const projectId = extractProjectId(ctx.project)
        if (!projectId) return

        const inbound = Number(ctx.request?.headers.get('content-length')) || 0
        // Outbound size is measured from the mapped `responseValue`:
        // strings/JSON serialize to the same wire size; Response returns
        // are already encoded (content-length set at send time, not
        // visible here) and fall back to 0.
        const value = ctx.responseValue
        let outbound = 0
        if (typeof value === 'string') {
          outbound = Buffer.byteLength(value)
        } else if (value && typeof value === 'object') {
          outbound = Buffer.byteLength(JSON.stringify(value))
        }

        void options
          .enqueue(projectId, [
            { key: MetricFor.REQUESTS, value: 1 },
            { key: MetricFor.INBOUND, value: inbound },
            { key: MetricFor.OUTBOUND, value: outbound },
          ])
          .catch(() => {
            // Same guarantee: stats emission never breaks the request path.
          })
      } catch {
        // Never break the request path over metrics.
      }
    })
}

/**
 * Resolves the platform project id from the derived project context —
 * either the `projectContext` union (`{ status: 'resolved', project: { id } }`)
 * or a bare `{ id }` carrier (unit-test composition).
 */
function extractProjectId(project: unknown): string | undefined {
  if (typeof project !== 'object' || project === null) return undefined
  const record = project as Record<string, unknown>
  if (typeof record.id === 'string' && record.id) return record.id
  if (typeof record.project === 'object' && record.project !== null) {
    const nested = record.project as Record<string, unknown>
    if (typeof nested.id === 'string' && nested.id) return nested.id
  }
  return undefined
}
