import { Processor } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Audit } from '@nuvix/audit'
import { Doc } from '@nuvix/db'
import { AppMode, configuration, QueueFor } from '@nuvix/utils'
import type { ProjectsDoc, UsersDoc } from '@nuvix/utils/types'
import { Job } from 'bullmq'
import { CoreService } from '../../core.service.js'
import { AbstractBatchQueue } from './batch.queue.js'

@Injectable()
@Processor(QueueFor.AUDITS, { concurrency: 50000 })
export class AuditsQueue extends AbstractBatchQueue<
  AuditLog,
  AuditsQueueJobData
> {
  protected readonly logger = new Logger(AuditsQueue.name)

  protected readonly batchSize = configuration.limits.batchSize || 5000

  protected readonly batchIntervalMs =
    configuration.limits.batchIntervalMs || 3000

  private readonly audits: Audit

  constructor(private readonly coreService: CoreService) {
    super()
    this.audits = new Audit(this.coreService.getDatabase())
  }

  protected buildItem(job: Job<AuditsQueueJobData>): AuditLog {
    const user = new Doc(job.data.user ?? {})

    return {
      userId: user.getSequence(),
      event: job.name,
      resource: job.data.resource,
      userAgent: job.data.userAgent || '',
      ip: job.data.ip || '',
      location: '',
      data: {
        userId: user.getId(),
        userName: user.get('name') || '',
        userEmail: user.get('email') || '',
        userType: user.get('type') || '',
        mode: job.data.mode,
        data: job.data.data || {},
      },
      timestamp: new Date(),
    }
  }

  protected async persist(batch: AuditLog[]): Promise<void> {
    this.logger.log(`Flushing ${batch.length} audit logs`)
    await this.audits.logBatch(batch)
  }
}

export type AuditsQueueJobData = {
  project: ProjectsDoc | object
  user: UsersDoc | object
  resource: string
  mode: AppMode
  userAgent?: string
  ip?: string
  data?: Record<string, any>
}

interface AuditLog {
  userId: number
  event: string
  resource: string
  userAgent: string
  ip: string
  location: string
  data: {
    userId: string
    userName: string
    userEmail: string
    userType: string
    mode: AppMode
    data: Record<string, any>
  }
  timestamp: Date
}
