import { QueueFor } from '@nuvix/utils'
import { type JobsOptions, Queue } from 'bullmq'
import { ID } from '../id'
import type {
  AuditJobData,
  BatchJobData,
  DeleteJobData,
  LogJobData,
  MailJobData,
  MessagingJobData,
  QueueManagerOptions,
  StatsJobData,
  WebhookJobData,
} from './types'

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

  getQueue<T = unknown>(name: string): Queue<T> | undefined {
    return this.queues.get(name) as Queue<T> | undefined
  }

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

  async enqueueMail(data: MailJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.MAILS, 'send_mail', data, opts)
  }

  async enqueueMessaging(data: MessagingJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.MESSAGING, 'send_message', data, opts)
  }

  async enqueueAudit(data: AuditJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.AUDITS, data.event, data, opts)
  }

  async enqueueStats(data: StatsJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.STATS, data.metric, data, opts)
  }

  async enqueueWebhook(data: WebhookJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.WEBHOOKS, data.event, data, opts)
  }

  async enqueueDelete(data: DeleteJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.DELETES, data.type, data, opts)
  }

  async enqueueLog(data: LogJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.LOGS, 'request_log', data, opts)
  }

  async enqueueBatch(data: BatchJobData, opts?: JobsOptions): Promise<string> {
    return this.addJob(QueueFor.BATCH, 'batch_operation', data, opts)
  }

  getInMemoryJobs(queueName: string): Array<{ id: string; name: string; data: unknown }> {
    return this.inMemoryJobs.get(queueName) ?? []
  }

  clearInMemoryJobs(): void {
    this.inMemoryJobs.clear()
  }

  async close(): Promise<void> {
    await Promise.all(Array.from(this.queues.values()).map((q) => q.close()))
    this.queues.clear()
    this.inMemoryJobs.clear()
  }
}

export function createQueueManager(options: QueueManagerOptions = {}): QueueManager {
  return new QueueManager(options)
}
