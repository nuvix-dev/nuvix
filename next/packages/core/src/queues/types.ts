import type { ConnectionOptions, JobsOptions } from 'bullmq'

export interface MailJobData {
  to: string
  subject: string
  body?: string
  template?: string
  data?: Record<string, unknown>
}

export interface MessagingJobData {
  provider: string
  to: string
  message: string
  data?: Record<string, unknown>
}

export interface AuditJobData {
  event: string
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
