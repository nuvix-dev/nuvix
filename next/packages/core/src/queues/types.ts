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
  metric: string
  value: number
  timestamp?: number
  projectId?: string
}

export interface WebhookJobData {
  webhookId: string
  projectId: string
  event: string
  payload: Record<string, unknown>
  url: string
  signatureKey?: string
  httpUser?: string
  httpPass?: string
}

export interface DeleteJobData {
  type: string
  resourceId: string
  projectId: string
  cascade?: boolean
}

export interface LogJobData {
  projectId: string
  method: string
  path: string
  statusCode: number
  durationMs: number
  headers?: Record<string, unknown>
  userId?: string
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
