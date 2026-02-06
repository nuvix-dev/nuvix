import { Processor } from '@nestjs/bullmq'
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { Audit, type AuditCreateInput } from '@nuvix/audit'
import { CoreService } from '@nuvix/core'
import { Queue } from '@nuvix/core/resolvers'
import { QueueFor } from '@nuvix/utils'
import type { Users } from '@nuvix/utils/types'
import { Job } from 'bullmq'

interface AuditLog extends AuditCreateInput {
  data: {
    userId: string
    userName: string
    userEmail: string
    userType: string
    mode: string
    data: Record<string, any>
  }
}

@Injectable()
@Processor(QueueFor.AUDITS, { concurrency: 50000 })
export class AuditsQueue
  extends Queue
  implements OnModuleInit, OnModuleDestroy
{
  private static readonly BATCH_SIZE = 1000 // Number of logs to process in one batch
  private static readonly BATCH_INTERVAL_MS = 1000 // Interval in milliseconds to flush
  private readonly logger = new Logger(AuditsQueue.name)
  private buffer: AuditLog[] = []
  private interval!: NodeJS.Timeout
  private readonly audit: Audit

  constructor(coreService: CoreService) {
    super()
    this.audit = coreService.getPlatformAudit()
  }

  onModuleInit() {
    this.startTimer()
  }

  async onModuleDestroy() {
    Logger.log('Module destroying. Flushing remaining logs...')
    clearInterval(this.interval)
    await this.flushBuffer()
  }

  private startTimer(): void {
    this.interval = setInterval(
      () => this.flushBuffer(),
      AuditsQueue.BATCH_INTERVAL_MS,
    )
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) {
      return
    }

    const logsToFlush = [...this.buffer]
    this.buffer = []

    try {
      this.logger.log(`Flushing ${logsToFlush.length} audit logs`)
      await this.audit.logBatch(logsToFlush)
    } catch (error) {
      this.logger.error('Error flushing audit logs:', error)
      // Re-add failed logs to buffer for retry
      this.buffer.push(...logsToFlush)
    }
  }

  async process(job: Job<AuditsQueueJobData>): Promise<void> {
    const { resource, mode, userAgent, ip, data } = job.data
    const user = job.data.user
    const log: AuditLog = {
      userId: user.$sequence ?? -1,
      event: job.name,
      resource,
      userAgent: userAgent || '',
      ip: ip || '',
      location: '', // Can be populated with a geo-IP service if needed
      data: {
        userId: user.$id,
        userName: user.name || '',
        userEmail: user.email || '',
        userType: user.type || '',
        mode,
        data: data || {},
      },
      time: new Date(),
    }

    this.buffer.push(log)

    if (this.buffer.length >= AuditsQueue.BATCH_SIZE) {
      // Temporarily stop the timer to avoid a race condition where the timer
      // and a full buffer try to flush at the same exact time.
      clearInterval(this.interval)
      await this.flushBuffer()
      this.startTimer() // Restart the timer
    }
  }
}

export type AuditsQueueJobData = {
  project?: any
  user: Users & { type: string }
  resource: string
  mode: string
  userAgent?: string
  ip?: string
  data?: Record<string, any>
}
