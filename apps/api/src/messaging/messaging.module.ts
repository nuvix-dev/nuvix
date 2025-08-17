import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { MessagingQueue } from '@nuvix/core/resolvers/queues/messaging.queue';
import { BullModule } from '@nestjs/bullmq';
import { QueueFor } from '@nuvix/utils';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QueueFor.MESSAGING,
    }),
  ],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingQueue],
})
export class MessagingModule {}
