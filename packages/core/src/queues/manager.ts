/** BullMQ queue manager with typed enqueue helpers and an in-memory fallback for tests. */
import { QueueFor } from '@nuvix/utils'
import { type ConnectionOptions, type JobsOptions, Queue } from 'bullmq'
import { ID } from '../id'
import type {
  AuditJobData,
  BatchJobData,
  DeleteJobData,
  LogJobData,
  MailJobData,
  MessagingJobData,
  ProjectJobData,
  QueueManagerOptions,
  StatsJobData,
  WebhookJobData,
} from './types'

/**
 * Parses a Redis URL (`redis://[:password@]host[:port][/db]`) into BullMQ
 * connection options. Missing/invalid input yields no port/host overrides —
 * BullMQ defaults apply (localhost:6379, db 0). Shared by every app that
 * runs queue workers (server + platform).
 */
export function parseRedisUrl(raw: string): ConnectionOptions {
  try {
    const url = new URL(raw)
    const options: ConnectionOptions = {
      host: url.hostname || undefined,
      port: url.port ? Number(url.port) : undefined,
    }
    if (url.username && url.username !== 'default') options.username = url.username
    if (url.password) options.password = url.password
    const db = Number(url.pathname.replace('/', ''))
    if (Number.isInteger(db) && db >= 0) options.db = db
    return options
  } catch {
    return {}
  }
}

/**
 * Owns the Queue instances for every job queue and routes typed enqueues.
 * Without a Redis connection (or with `isTest`), jobs buffer in memory so
 * callers and tests can enqueue without infrastructure.
 */
export class QueueManager {
  private readonly queues = new Map<string, Queue>()
  private readonly inMemoryJobs = new Map<
    string,
    Array<{ id: string; name: string; data: unknown }>
  >()
  private readonly isTestMode: boolean

  constructor(options: QueueManagerOptions = {}) {
    this.isTestMode = options.isTest || !options.connection

    if (!this.isTestMode && options.connection) {
      const queueNames = [
        QueueFor.MAILS,
        QueueFor.MESSAGING,
        QueueFor.AUDITS,
        QueueFor.STATS,
        QueueFor.WEBHOOKS,
        QueueFor.DELETES,
        QueueFor.LOGS,
        QueueFor.BATCH,
      ]

      for (const name of queueNames) {
        this.queues.set(
          name,
          new Queue(name, {
            connection: options.connection,
            prefix: options.prefix,
            defaultJobOptions: options.defaultJobOptions,
          }),
        )
      }
    }
  }

  /** Access a live queue for custom consumers. */
  getQueue<T = unknown>(name: string): Queue<T> | undefined {
    return this.queues.get(name) as Queue<T> | undefined
  }

  /** Route one job: real Redis enqueue, or in-memory record in test mode. */
  private async addJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    opts?: JobsOptions,
  ): Promise<string> {
    if (this.isTestMode) {
      const jobId = `job_${ID.unique()}`
      const list = this.inMemoryJobs.get(queueName) ?? []
      list.push({ id: jobId, name: jobName, data })
      this.inMemoryJobs.set(queueName, list)
      return jobId
    }

    const queue = this.queues.get(queueName)
    if (!queue) {
      throw new Error(`Queue "${queueName}" is not initialized`)
    }

    const job = await queue.add(jobName, data, opts)
    return job.id ?? `job_${ID.unique()}`
  }

  /** Queue a mail send.. */
  async enqueueMail(data: MailJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.MAILS, 'send_mail', data, opts)
  }

  /** Queue a message delivery.. */
  async enqueueMessaging(data: MessagingJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.MESSAGING, 'send_message', data, opts)
  }

  /** Queue an audit write (job name = event).. */
  async enqueueAudit(data: AuditJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.AUDITS, data.event, data, opts)
  }

  /** Queue usage metrics for one event.. */
  async enqueueStats(data: StatsJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.STATS, 'add-metric', data, opts)
  }

  /** Queue a webhook delivery attempt.. */
  async enqueueWebhook(data: WebhookJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.WEBHOOKS, data.event, data, opts)
  }

  /** Queue a resource deletion.. */
  async enqueueDelete(data: DeleteJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.DELETES, data.type, data, opts)
  }

  /**
   * Project provisioning (platform): the slow readiness-wait + auth-schema
   * bootstrap runs on the PROJECTS queue; the doc is created first with
   * `status: 'provisioning'`.
   */
  async enqueueProject(data: ProjectJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.PROJECTS, 'provision', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86_400 },
      ...opts,
    })
  }

  /** Queue a request-log row.. */
  async enqueueLog(data: LogJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.LOGS, 'log', data, opts)
  }

  /** Queue a batch of operations.. */
  async enqueueBatch(data: BatchJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.BATCH, 'batch_operation', data, opts)
  }

  /** Inspect buffered jobs in test mode. */
  getInMemoryJobs(queueName: string): Array<{ id: string; name: string; data: unknown }> {
    return this.inMemoryJobs.get(queueName) ?? []
  }

  /** Reset buffered jobs between tests. */
  clearInMemoryJobs(): void {
    this.inMemoryJobs.clear()
  }

  /** Close every queue's connection and drop buffers. */
  async close(): Promise<void> {
    await Promise.all(Array.from(this.queues.values()).map((q) => q.close()))
    this.queues.clear()
    this.inMemoryJobs.clear()
  }
}

/** Factory for the queue manager. */
export function createQueueManager(options: QueueManagerOptions = {}): QueueManager {
  return new QueueManager(options)
}
