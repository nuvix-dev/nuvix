/**
 * API request logs — admin routes over the tenant `api_logs`
 * collection (auth schema; each project's logs live in its own tenant
 * database).
 *
 * Two auth legs:
 *  - tenant-local secret API key (`x-nuvix-key` → `auth.type === 'apiKey'`),
 *  - console operator JWT (`Authorization: Bearer`, `aud: 'console'`) —
 *    lets the console UI read project logs directly from the server API.
 *
 * Filtering uses simple query params (method, status, path prefix,
 * resource tag, timestamp bounds) — enough for the console UI and easy
 * to grep from the CLI.
 */

import { verifyJwt } from '@nuvix/core/auth'
import type { TenantResource } from '@nuvix/core/tenants'
import { Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { UnauthorizedError } from '../shared/errors'

const MAX_LIMIT = 100

/** Verifies a console-operator JWT (aud 'console'), else null. */
async function consoleJwtSubject(
  authorization: unknown,
  jwtSecret: string,
): Promise<string | null> {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return null
  }
  const token = authorization.slice(7).trim()
  if (!token) return null
  const payload = await verifyJwt(token, jwtSecret)
  if (payload?.aud !== 'console' || !payload.sub) return null
  return String(payload.sub)
}

/** Bind the logs routes; reads resolve through the composed tenant context. */
export function logsRoutes(options: { jwtSecret: string }) {
  return new Elysia({ name: 'logs-routes' }).get(
    '/logs',
    {
      detail: {
        summary: 'List API request logs',
        description:
          "Admin-only: returns this project's API request logs from the tenant database. Auth: tenant-local API key (x-nuvix-key) or a console operator JWT (Authorization: Bearer). Ordered newest first.",
        tags: ['Logs'],
      },
      query: t.Object({
        limit: t.Optional(t.Integer({ minimum: 1, maximum: MAX_LIMIT, default: 25 })),
        offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
        method: t.Optional(t.String({ description: 'Filter by HTTP method' })),
        status: t.Optional(t.Integer({ description: 'Filter by response status' })),
        path: t.Optional(t.String({ description: 'Filter by path prefix' })),
        resource: t.Optional(t.String({ description: 'Filter by resource tag' })),
        since: t.Optional(t.String({ description: 'ISO timestamp lower bound' })),
        until: t.Optional(t.String({ description: 'ISO timestamp upper bound' })),
      }),
    },
    (ctx) => logsHandler(ctx as never, options.jwtSecret),
  )
}

interface LogsQuery {
  limit?: number
  offset?: number
  method?: string
  status?: number
  path?: string
  resource?: string
  since?: string
  until?: string
}

interface LogsCtx {
  auth: unknown
  headers: Record<string, unknown>
  tenantResource?: TenantResource
  query: LogsQuery
}

async function logsHandler(
  raw: LogsCtx & Record<string, unknown>,
  jwtSecret: string,
): Promise<{ total: number; logs: Array<Record<string, unknown>> }> {
  const { auth, headers, tenantResource, query } = raw

  // Auth leg 1: tenant-local API key (admin).
  const isApiKey =
    auth &&
    typeof auth === 'object' &&
    'type' in auth &&
    (auth as { type?: string }).type === 'apiKey'

  // Auth leg 2: console operator JWT.
  const consoleSubject = await consoleJwtSubject(headers.authorization, jwtSecret)

  if (!isApiKey && !consoleSubject) {
    throw new UnauthorizedError('Admin auth required', {
      code: 'logs_unauthorized',
    })
  }

  const session: Session = tenantResource?.authSystemSession?.() as Session

  const filters: Query[] = []
  if (query.method) filters.push(Query.equal('method', [query.method.toUpperCase()]))
  if (query.status !== undefined) filters.push(Query.equal('status', [query.status]))
  if (query.resource) filters.push(Query.equal('resource', [query.resource]))
  if (query.path) filters.push(Query.contains('path', [query.path]))
  if (query.since) filters.push(Query.greaterThanEqual('timestamp', query.since))
  if (query.until) filters.push(Query.lessThanEqual('timestamp', query.until))

  const limit = Math.min(query.limit ?? 25, MAX_LIMIT)
  const offset = query.offset ?? 0

  const total = await session.count('api_logs', filters)
  const rows = await session.find('api_logs', [
    ...filters,
    Query.orderDesc('timestamp'),
    Query.limit(limit),
    Query.offset(offset),
  ])

  return {
    total,
    logs: rows.map((row) => row.toObject() as unknown as Record<string, unknown>),
  }
}
