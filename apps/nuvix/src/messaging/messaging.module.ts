import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { MessagingQueue } from '@nuvix/core/resolvers/queues/messaging.queue';
import { BullModule } from '@nestjs/bullmq';
import { WORKER_TYPE_MESSAGING } from '@nuvix/utils/constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: WORKER_TYPE_MESSAGING,
    }),
  ],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingQueue],
})
export class MessagingModule { }
