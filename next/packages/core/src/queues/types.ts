/** Payload contracts for every background job queue. Each interface maps to one named queue in `QueueFor`. */
import type { ConnectionOptions, JobsOptions } from 'bullmq'

/** One transactional or bulk email send. */
export interface MailJobData {
  /** Platform project id — resolves the project's SMTP override/profile. */
  projectId: string
  /** Recipient address (single) — bulk sends pass `emails` instead. */
  email?: string
  emails?: string[]
  subject: string
  /** Inner-rendered email content (wrapped by the base template). */
  body: string
  /** Variables for the base wrapper template (project, redirect, otp, …). */
  variables?: Record<string, unknown>
  /** Per-project SMTP override (project record). */
  server?: {
    host: string
    port: number
    username: string
    password: string
    secure: boolean
    senderEmail: string
    senderName: string
    replyTo: string
  }
  /** Base wrapper template path override (absolute). */
  bodyTemplate?: string
}

/** One message delivery (immediate or from a schedule). */
export interface MessagingJobData {
  /** Platform project id — resolves the tenant database. */
  projectId: string
  /**
   * Message id for scheduled deliveries, or the full message record for
   * inline enqueues at creation time.
   */
  message: string | Record<string, unknown>
  /** Schedule document id — deleted after a scheduled message delivers. */
  scheduleId?: string
}

/** One audit-trail write. */
export interface AuditJobData {
  event: string
  /** Platform project id — workers resolve the tenant database from it. */
  projectId?: string
  userId?: string
  resource?: string
  ip?: string
  userAgent?: string
  data?: Record<string, unknown>
}

/** Usage metrics for a single event. */
export interface StatsJobData {
  /** Platform project id — resolves the tenant database (auth schema). */
  projectId: string
  /** Metrics to increment for the event (typically one row per key). */
  metrics: Array<{ key: string; value: number }>
}

/** One webhook delivery attempt. */
export interface WebhookJobData {
  /** Platform project id (jobs resolve through the platform registry). */
  projectId: string
  webhookId: string
  /** Internal sequence — keys subsequent webhook_logs rows. */
  webhookInternalId?: number
  event: string
  payload: Record<string, unknown>
  /** Delivery attempt counter at enqueue/processing time. */
  attempts?: number
}

/** One resource deletion (optionally cascading). */
export interface DeleteJobData {
  type: string
  resourceId: string
  projectId: string
  cascade?: boolean
}

/** One request-log row to persist. */
export interface LogJobData {
  /** Platform project id — resolves the tenant database. */
  projectId: string
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
}

/** One project provisioning request. */
export interface ProjectJobData {
  /** Platform project id — the doc is created before the job enqueues. */
  projectId: string
}

/** One batch of queued operations. */
export interface BatchJobData {
  operations: unknown[]
  projectId?: string
}

/** Queue manager construction options. */
export interface QueueManagerOptions {
  connection?: ConnectionOptions
  prefix?: string
  defaultJobOptions?: JobsOptions
  /** When true or when connection is omitted, jobs are buffered in-memory without connecting to Redis. */
  isTest?: boolean
}
