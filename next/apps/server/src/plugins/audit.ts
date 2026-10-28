/** Provides route-level audit mapping, sensitive-payload filtering, queue emission, and webhook fan-out. */

import type { QueueManager } from '@nuvix/core/queues'

export interface AuditMeta {
  /** Stable event key, e.g. `user.create`, `session.delete`. */
  event: string
  /** Resource template, e.g. `user/{res.$id}` or `team/{params.teamId}`. */
  resource?: string
  /** Template for the acting user id override, e.g. `{res.userId}`. */
  userId?: string
}

export interface AuditEnqueueInput {
  event: string
  /** Platform project id — workers resolve the tenant database from it. */
  projectId?: string
  resource?: string
  /** Acting user id (public). */
  userId?: string
  /** Internal user sequence — resolved by the caller when available. */
  userSequence?: number
  userName?: string
  userEmail?: string
  userType?: string
  mode?: string
  ip?: string
  userAgent?: string
  data?: Record<string, unknown>
}

export type AuditEnqueuer = (data: AuditEnqueueInput) => Promise<void>

let enqueueAudit: AuditEnqueuer = async () => {
  // Not initialized (unit-test composition) — audits are dropped silently.
}

/** Injectable webhook fan-out boundary sharing the audit request hook; uninitialized composition is a no-op. */
export type WebhookFanout = (
  projectId: string,
  event: string,
  payload: Record<string, unknown>,
) => Promise<void>

let webhookFanout: WebhookFanout = async () => {}

/** Initializes the audit emitter (called once from app composition). */
export function initAuditEmitter(enqueuer: AuditEnqueuer): void {
  enqueueAudit = enqueuer
}

/** Initializes the webhook fan-out boundary (called once from composition). */
export function initWebhookFanout(fanout: WebhookFanout): void {
  webhookFanout = fanout
}

/** Creates the production emitter from a QueueManager. */
export function auditEnqueuerFrom(queues: QueueManager): AuditEnqueuer {
  return async (data) => {
    await queues.enqueueAudit(data)
  }
}

/** In-memory recorder for tests. */
export function initInMemoryAuditEmitter(): { events: AuditEnqueueInput[] } {
  const events: AuditEnqueueInput[] = []
  initAuditEmitter(async (data) => {
    events.push(data)
  })
  return { events }
}

// Template mapping for request, response, user, and route-parameter sources.

const MAPPING_PART = /\{(\w+)\.([^}]+)\}/

type AuditSources = {
  params?: Record<string, unknown>
  query?: Record<string, unknown>
  body?: Record<string, unknown>
  response?: Record<string, unknown>
  user?: { id?: string; sequence?: number }
}

function mapValue(template: string, sources: AuditSources): string {
  const path = template.slice(1, -1)
  const [type, key] = path.split('.') as [string, string]
  let value: unknown
  switch (type) {
    case 'req':
      value = sources.params?.[key] ?? sources.query?.[key] ?? sources.body?.[key]
      break
    case 'res':
      value = sources.response?.[key]
      break
    case 'params':
      value = sources.params?.[key]
      break
    case 'query':
      value = sources.query?.[key]
      break
    case 'body':
      value = sources.body?.[key]
      break
    case 'user':
      // Resolve user templates from the current authenticated user document.
      value = key === '$id' || key === 'id' ? sources.user?.id : sources.user?.sequence
      break
    default:
      value = 'Unknown'
  }
  return value === undefined || value === null ? 'Unknown' : String(value)
}

/** Maps `user/{res.$id}` → `user/u123` using the request/response sources. */
export function mapAuditResource(template: string, sources: AuditSources): string {
  return template
    .split('/')
    .map((part) => (MAPPING_PART.test(part) ? mapValue(part, sources) : part))
    .join('/')
}

/** Resolves a `{res.userId}`-style template to its value (or undefined). */
export function mapAuditTemplateValue(template: string, sources: AuditSources): string | undefined {
  const value = mapValue(template, sources)
  return value === 'Unknown' ? undefined : value
}

/** Fields that must never be written to audit payloads. */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHistory',
  'hash',
  'hashOptions',
  'secret',
  'providerAccessToken',
  'providerRefreshToken',
])

function stripSensitive(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key)) continue
    out[key] = value
  }
  return out
}

// Per-route afterHandle hook.

/** Shape of the Elysia route context our hook reads (all optional-tolerant). */
export interface AuditedHookContext {
  request: Request
  responseValue?: unknown
  params?: Record<string, string>
  query?: Record<string, string>
  body?: unknown
  user?: unknown
  /**
   * Project context as derived by `projectContext` — the `ProjectContext`
   * union (`{ status: 'resolved', project }`) or, in test composition, a
   * bare `{ id }` carrier.
   */
  project?: unknown
}

interface ExtractedUser {
  id?: string
  sequence?: number
  name?: string
  email?: string
  type?: string
}

function extractUser(user: unknown): ExtractedUser {
  if (!user || typeof user !== 'object') return {}
  const candidate = user as {
    getId?: () => string
    getSequence?: () => number
    get?: (key: string) => unknown
    empty?: () => boolean
    id?: unknown
  }
  if (typeof candidate.getId === 'function') {
    if (candidate.empty?.()) return {}
    return {
      id: candidate.getId() || undefined,
      sequence: candidate.getSequence?.(),
      name: (candidate.get?.('name') as string) || undefined,
      email: (candidate.get?.('email') as string) || undefined,
      type: (candidate.get?.('type') as string) || undefined,
    }
  }
  const record = user as Record<string, unknown>
  return { id: record.id ? String(record.id) : undefined }
}

/**
 * Resolves the platform project id from the derived project context —
 * either the `projectContext` union (`{ status: 'resolved', project: { id } }`)
 * or a bare `{ id }` carrier (unit-test composition).
 */
function extractProjectId(project: unknown): string | undefined {
  if (!isRecord(project)) return undefined
  if (typeof project.id === 'string' && project.id) return project.id
  if (isRecord(project.project)) {
    const nested = project.project
    if (typeof nested.id === 'string' && nested.id) return nested.id
  }
  return undefined
}

/** Build a per-route afterHandle hook that maps and emits the configured audit event. */
export function auditAfter(meta: AuditMeta) {
  // `(ctx: unknown)` keeps the hook assignable to any route's afterHandle
  // signature (Elysia contexts are narrowed per-route; we read a subset).
  return (raw: unknown): void => {
    const ctx = raw as AuditedHookContext
    try {
      const user = extractUser(ctx.user)
      const response = isRecord(ctx.responseValue) ? ctx.responseValue : undefined
      const sources: AuditSources = {
        params: ctx.params,
        query: ctx.query,
        body: isRecord(ctx.body) ? ctx.body : undefined,
        response,
        user,
      }
      const resource = meta.resource ? mapAuditResource(meta.resource, sources) : undefined
      const userIdTemplate = meta.userId ? mapAuditTemplateValue(meta.userId, sources) : undefined

      const forwarded =
        ctx.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
      const projectId = extractProjectId(ctx.project)
      const auditPayload = response ? stripSensitive(response) : undefined

      void enqueueAudit({
        event: meta.event,
        projectId,
        resource,
        userId: userIdTemplate ?? user.id,
        userSequence: user.sequence,
        userName: user.name,
        userEmail: user.email,
        userType: user.type,
        ip: forwarded || undefined,
        userAgent: ctx.request?.headers.get('user-agent') ?? undefined,
        data: auditPayload,
      }).catch(() => {
        // Audit emission must never break the request path.
      })

       // Webhook fan-out reuses the sanitized audit payload.
      if (projectId) {
        void webhookFanout(projectId, meta.event, auditPayload ?? {}).catch(() => {
          // Fan-out failures must never break the request path either.
        })
      }
    } catch {
      // Same guarantee: mapping/enqueue errors are swallowed.
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
