import type { ConnectionOptions, JobsOptions } from 'bullmq'

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

export interface MessagingJobData {
  /** Platform project id — resolves the tenant database. */
  projectId: string
  /**
   * Message id (scheduled jobs) or the full message record (inline
   * enqueue at create, v1 `MessagingJob.EXTERNAL` parity).
   */
  message: string | Record<string, unknown>
  /** Schedule document id — deleted after a scheduled message delivers. */
  scheduleId?: string
}

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

export interface StatsJobData {
  /** Platform project id — resolves the tenant database (auth schema). */
  projectId: string
  /** One job carries the metrics of a single event (v1 parity). */
  metrics: Array<{ key: string; value: number }>
}

export interface WebhookJobData {
  /** Platform project id (jobs resolve through the platform registry). */
  projectId: string
  webhookId: string
  /** Internal sequence — keys subsequent webhook_logs rows. */
  webhookInternalId?: number
  event: string
  payload: Record<string, unknown>
  /** Delivery attempt counter at enqueue/processing time (v1 parity). */
  attempts?: number
}

export interface DeleteJobData {
  type: string
  resourceId: string
  projectId: string
  cascade?: boolean
}

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

export interface BatchJobData {
  operations: unknown[]
  projectId?: string
}

export interface QueueManagerOptions {
  connection?: ConnectionOptions
  prefix?: string
  defaultJobOptions?: JobsOptions
  /** When true or when connection is omitted, jobs are buffered in-memory without connecting to Redis. */
  isTest?: boolean
}
