/**
 * API request-log source: every served request enqueues one `api_logs`
 * row (method, path, status, timestamp, IP, UA, metadata redacted later
 * in the worker).
 *
 * Skipped:
 *  - API-key callers (`ctx.auth.type === 'apiKey'`) — platform/console
 *    maintenance traffic, not product usage,
 *  - the health probe and the OpenAPI spec surface.
 *
 * The request path is the only place with response status/latency; the
 * worker deep-redacts metadata at buffer time. Elysia beta.6's minimal
 * afterResponse context is bridged through the shared-instance derive
 * chain (project/auth), the same pattern as the stats source.
 */

import type { Elysia } from 'elysia'

/** Queue boundary — app composition supplies the QueueManager enqueuer. */
export type LogsEnqueuer = (
  projectId: string,
  row: {
    request_id: string
    method: string
    path: string
    status: number
    timestamp: string
    client_ip?: string
    user_agent?: string
    resource?: string
    latency_ms?: number
    region?: string
    error?: string
    metadata?: Record<string, unknown>
  },
) => Promise<void>

const SKIP_PATHS = new Set(['/health', '/v2/openapi', '/v2/openapi/json'])

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

/** Compose request-log emission onto the consuming instance. */
export function logsRequestSource(options: {
  enqueue: LogsEnqueuer
  enabled?: () => boolean
}): (app: Elysia) => Elysia {
  const enabled = options.enabled ?? (() => true)
  // Function-style plugin — registers the hook directly on the consuming
  // instance (same pattern as `rateLimit` and the stats source).
  return (app) =>
    app.afterResponse((raw: unknown): void => {
      try {
        if (!enabled()) return
        const ctx = raw as {
          request?: Request
          responseValue?: unknown
          status?: number
          project?: unknown
          auth?: unknown
        }

        const url = new URL(ctx.request?.url ?? 'http://localhost/')
        if (SKIP_PATHS.has(url.pathname)) return

        // API-key callers are admin/maintenance traffic, never product usage.
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

        const status =
          typeof ctx.status === 'number'
            ? ctx.status
            : ctx.responseValue instanceof Response
              ? ctx.responseValue.status
              : 200
        // The post-response context has no error message; non-2xx
        // requests record just the status code.
        const error = status >= 400 ? `Error response (${status})` : undefined

        const forwarded =
          ctx.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined

        void options
          .enqueue(projectId, {
            request_id: crypto.randomUUID(),
            method: ctx.request?.method ?? 'GET',
            path: url.pathname,
            status,
            timestamp: new Date().toISOString(),
            client_ip: forwarded,
            user_agent: ctx.request?.headers.get('user-agent') ?? undefined,
            resource: 'unknown',
            region: 'default',
            error,
            metadata: {
              headers: Object.fromEntries(ctx.request?.headers.entries() ?? []),
              query: Object.fromEntries(url.searchParams.entries()),
            },
          })
          .catch(() => {
            // Logging must never break the request path.
          })
      } catch {
        // Same guarantee.
      }
    })
}
