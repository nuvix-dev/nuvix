import { BullModule, InjectQueue } from '@nestjs/bullmq'
import {
  Logger,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common'
import {
  ApiHook,
  AuditHook,
  AuthHook,
  MessagingJob,
  MessagingJobData,
  MessagingQueue,
  StatsHook,
} from '@nuvix/core/resolvers'
import { QueueFor, ScheduleResourceType } from '@nuvix/utils'
import { MessagingController } from './messaging.controller'
import { MessagingService } from './messaging.service'
import { ProvidersController } from './providers/providers.controller'
import { ProvidersService } from './providers/providers.service'
import { SubscribersController } from './topics/subscribers/subscribers.controller'
import { SubscribersService } from './topics/subscribers/subscribers.service'
import { TopicsController } from './topics/topics.controller'
import { TopicsService } from './topics/topics.service'
import { CoreService } from '@nuvix/core'
import { Events } from '@nuvix/db'
import { SchedulesDoc } from '@nuvix/utils/types'
import type { Queue } from 'bullmq'

@Module({
  imports: [
    BullModule.registerQueue({
      name: QueueFor.MESSAGING,
    }),
  ],
  controllers: [
    MessagingController,
    ProvidersController,
    TopicsController,
    SubscribersController,
  ],
  providers: [
    MessagingService,
    ProvidersService,
    TopicsService,
    SubscribersService,
    MessagingQueue,
  ],
})
export class MessagingModule implements NestModule {
  private readonly logger = new Logger(MessagingModule.name)
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthHook, ApiHook, StatsHook, AuditHook)
      .forRoutes(
        MessagingController,
        ProvidersController,
        TopicsController,
        SubscribersController,
      )
  }

  constructor(
    coreService: CoreService,
    @InjectQueue(QueueFor.MESSAGING)
    private readonly queue: Queue<MessagingJobData, any, MessagingJob>,
  ) {
    const db = coreService.getPlatformDb()

    db.on(Events.DocumentCreate, 'messaging_schedule', async doc => {
      try {
        if (doc.getCollection() !== 'schedules') return

        const schedule = doc as SchedulesDoc

        // Only process message schedules
        if (schedule.get('resourceType') !== ScheduleResourceType.MESSAGE) {
          return
        }

        // Ignore inactive schedules
        if (!schedule.get('active')) {
          return
        }

        const scheduleId = schedule.getId()
        const messageId = schedule.get('resourceId')
        const projectId = schedule.get('projectId')
        const scheduledAtRaw = schedule.get('schedule')

        const project = await db.getDocument('projects', projectId)

        if (!messageId || !projectId || !scheduledAtRaw || project.empty()) {
          this.logger.warn(`Invalid schedule document ${scheduleId}`)
          return
        }

        const scheduledAt = new Date(scheduledAtRaw)
        if (isNaN(scheduledAt.getTime())) {
          this.logger.warn(`Invalid schedule date for ${scheduleId}`)
          return
        }

        // Calculate delay
        const delay = Math.max(scheduledAt.getTime() - Date.now(), 0)

        const jobId = `schedule:${scheduleId}`

        // Prevent duplicate jobs
        const existing = await this.queue.getJob(jobId)
        if (existing) {
          this.logger.debug(`Schedule ${scheduleId} already queued`)
          return
        }

        // Enqueue delayed job
        await this.queue.add(
          MessagingJob.EXTERNAL,
          {
            scheduleId,
            message: messageId,
            project,
          },
          {
            delay,
            jobId,
            removeOnComplete: true,
            removeOnFail: false,
          },
        )

        this.logger.log(
          `Scheduled message ${messageId} (schedule ${scheduleId}) in ${delay}ms`,
        )
      } catch (err) {
        this.logger.error(
          'Failed to enqueue scheduled message',
          err instanceof Error ? err.stack : undefined,
        )
      }
    })
  }
}
