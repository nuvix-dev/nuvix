import { Processor } from '@nestjs/bullmq'
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { Audit } from '@nuvix/audit'
import { Doc } from '@nuvix/db'
import { AppMode, configuration, QueueFor, Schemas } from '@nuvix/utils'
import type { ProjectsDoc, UsersDoc } from '@nuvix/utils/types'
import { Job } from 'bullmq'
import { CoreService } from '../../core.service.js'
import { Queue } from './queue'

interface AuditLogsBuffer {
  project: ProjectsDoc
  logs: AuditLog[]
}

@Injectable()
@Processor(QueueFor.AUDITS, { concurrency: 50000 })
export class AuditsQueue
  extends Queue
  implements OnModuleInit, OnModuleDestroy
{
  private static readonly BATCH_SIZE = configuration.limits.batchSize || 5000
  private static readonly BATCH_INTERVAL_MS =
    configuration.limits.batchIntervalMs || 3000
  private readonly logger = new Logger(AuditsQueue.name)
  private buffer = new Map<number, AuditLogsBuffer>()
  private interval!: NodeJS.Timeout

  constructor(private readonly coreService: CoreService) {
    super()
  }

  onModuleInit() {
    this.startTimer()
  }

  async onModuleDestroy() {
    this.logger.log('Module destroying. Flushing remaining logs...')
    clearInterval(this.interval)
    await this.flushBuffer()
  }

  private startTimer(): void {
    if (this.interval) {
      clearInterval(this.interval)
    }
    this.interval = setInterval(
      () => this.flushBuffer(),
      AuditsQueue.BATCH_INTERVAL_MS,
    )
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.size === 0) {
      return
    }

    const bufferCopy = new Map(this.buffer)
    this.buffer.clear()

    for (const [projectId, data] of bufferCopy.entries()) {
      if (data.logs.length === 0) {
        continue
      }
      const { project, logs } = data

      const { client, dbForProject } =
        await this.coreService.createProjectDatabase(project, {
          schema: Schemas.Core,
        })
      try {
        const audits = new Audit(dbForProject)

        this.logger.log(
          `Flushing ${logs.length} audit logs for project ${projectId}`,
        )
        await audits.logBatch(logs)
      } catch (error) {
        this.logger.error(
          `Error flushing audit logs for project ${projectId}:`,
          error,
        )
        // Re-add failed logs to buffer for retry
        const currentBuffer = this.buffer.get(projectId) || {
          project: data.project,
          logs: [],
        }
        currentBuffer.logs.push(...data.logs)
        this.buffer.set(projectId, currentBuffer)
      } finally {
        await this.coreService.releaseDatabaseClient(client)
      }
    }
  }

  async process(job: Job<AuditsQueueJobData>): Promise<void> {
    const { resource, mode, userAgent, ip, data } = job.data
    const project = new Doc(job.data.project as object)
    const user = new Doc(job.data.user ?? {})
    const projectId = project.getSequence()

    const log: AuditLog = {
      userId: user.getSequence(),
      event: job.name,
      resource,
      userAgent: userAgent || '',
      ip: ip || '',
      location: '', // Location can be derived from userAgent or IP if needed
      data: {
        userId: user.getId(),
        userName: user.get('name') || '',
        userEmail: user.get('email') || '',
        userType: user.get('type') || '',
        mode,
        data: data || {},
      },
      timestamp: new Date(),
    }

    if (!this.buffer.has(projectId)) {
      this.buffer.set(projectId, {
        project: new Doc({
          $id: project.getId(),
          $sequence: projectId,
          database: project.get('database'),
        }) as unknown as ProjectsDoc,
        logs: [],
      })
    }

    this.buffer.get(projectId)?.logs.push(log)

    if (
      (this.buffer.get(projectId)?.logs.length ?? 0) >= AuditsQueue.BATCH_SIZE
    ) {
      // Temporarily stop the timer to avoid a race condition where the timer
      // and a full buffer try to flush at the same exact time.
      clearInterval(this.interval)
      await this.flushBuffer()
      this.startTimer() // Restart the timer
    }
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
