import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { MessagingQueue } from '@nuvix/core/resolvers/queues/messaging.queue';
import { BullModule } from '@nestjs/bullmq';
import { QueueFor } from '@nuvix/utils';
import { AuthHook, ApiHook, StatsHook, AuditHook } from '@nuvix/core/resolvers';
import { ProvidersController } from './providers/providers.controller';
import { TopicsController } from './topics/topics.controller';
import { SubscribersController } from './topics/subscribers/subscribers.controller';
import { ProvidersService } from './providers/providers.service';
import { TopicsService } from './topics/topics.service';
import { SubscribersService } from './topics/subscribers/subscribers.service';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: QueueFor.MESSAGING,
      },
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
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
      );
  }
}
