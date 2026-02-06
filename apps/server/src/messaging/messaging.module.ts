import { BullModule } from '@nestjs/bullmq'
import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common'
import {
  ApiHook,
  AuditHook,
  AuthHook,
  MessagingQueue,
  StatsHook,
} from '@nuvix/core/resolvers'
import { QueueFor } from '@nuvix/utils'
import { MessagingController } from './messaging.controller'
import { MessagingService } from './messaging.service'
import { ProvidersController } from './providers/providers.controller'
import { ProvidersService } from './providers/providers.service'
import { SubscribersController } from './topics/subscribers/subscribers.controller'
import { SubscribersService } from './topics/subscribers/subscribers.service'
import { TopicsController } from './topics/topics.controller'
import { TopicsService } from './topics/topics.service'

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: QueueFor.MESSAGING,
      },
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
      { name: QueueFor.DELETES },
    ),
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
}
