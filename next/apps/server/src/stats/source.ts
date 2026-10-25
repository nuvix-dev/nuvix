/**
 * Stats sources — v2 port of legacy `StatsHook` (request-path network
 * metrics) and `StatsHelper` (tenant document-event usage metrics).
 *
 * Document events (v1 `connect` parity): the composition wires every
 * tenant `Database` through `wireStatsDatabase`, which registers
 * `calculate-usage` listeners and enqueues metric batches — users, teams,
 * sessions, buckets, files (+ storage bytes).
 *
 * v1 compensation notes (redesign, recorded in MIGRATION.md):
 *  - No `reduce` path: v2 deletes sessions/files row-by-row, so their
 *    DocumentDelete events already decrement the aggregate metrics.
 *  - No per-bucket `{bucketInternalId}.files` metrics: v2 keeps one
 *    `files` collection (bucketId attribute) instead of per-bucket
 *    collections.
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
 * database (v1 `StatsHelper.connect` parity). Events must never break
 * request paths — the enqueue side is fire-and-forget.
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
      // Stats emission must never break the request path (v1 parity).
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

/**
 * Metric mapping for one document delta (v1 `usageDatabaseListener`
 * parity, minus the per-bucket-collection keys — see module docs).
 */
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
    case 'files':
      return [
        { key: MetricFor.FILES, value },
        {
          key: MetricFor.FILES_STORAGE,
          value: Number(document?.get?.('sizeOriginal') ?? 0) * value,
        },
      ]
    default:
      return []
  }
}

/**
 * Request-path network metrics (v1 `StatsHook.onResponse` parity):
 * requests count + inbound/outbound bytes. Skipped for API-key callers
 * (v1 `isAdminUser` parity — those are console/platform maintenance
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
          /** Mapped handler return (Elysia afterResponse parity). */
          responseValue?: unknown
          project?: unknown
          auth?: unknown
        }
        // API-key callers are v1's "admin" traffic — not usage.
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
        // v1 measured the serialized response body (Fastify Content-Length).
        // Elysia's afterResponse hands us the mapped `responseValue` —
        // strings/JSON serialize to the same wire size; Response returns
        // are already encoded (content-length set at send time, not
        // visible here) and fall back to 0, same as v1's missing header.
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
