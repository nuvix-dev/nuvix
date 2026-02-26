import { Processor } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { configuration, QueueFor, Schemas } from '@nuvix/utils'
import type { ProjectsDoc } from '@nuvix/utils/types'
import { Job } from 'bullmq'
import { CoreService } from '../../core.service.js'
import { AbstractBatchQueue } from './batch.queue.js'
import { DataSource } from '@nuvix/pg'

@Injectable()
@Processor(QueueFor.LOGS, { concurrency: 5000 })
export class ApiLogsQueue extends AbstractBatchQueue<
  ApiLog,
  ApiLogsQueueJobData
> {
  protected readonly logger = new Logger(ApiLogsQueue.name)

  protected readonly batchSize = configuration.limits.batchSize || 5000

  protected readonly batchIntervalMs =
    configuration.limits.batchIntervalMs || 3000

  private readonly dataSource: DataSource

  constructor(private readonly coreService: CoreService) {
    super()
    this.dataSource = this.coreService.getDataSource()
  }

  protected buildItem(job: Job<ApiLogsQueueJobData>): ApiLog {
    return job.data.log
  }

  protected async persist(batch: ApiLog[]): Promise<void> {
    await this.dataSource
      .table('api_logs')
      .withSchema(Schemas.System)
      .insert(batch)

    this.logger.log(`Flushed ${batch.length} api logs`)
  }
}

export type ApiLogsQueueJobData = {
  project: ProjectsDoc | object
  log: ApiLog
}

export interface ApiLog {
  request_id: string
  method: string
  path: string
  status: number
  timestamp: Date
  client_ip?: string
  user_agent?: string
  resource: string
  url?: string
  latency_ms?: number
  region?: string
  error?: string
  metadata?: Record<string, any>
}
