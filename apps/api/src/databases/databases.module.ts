import { Module } from '@nestjs/common';
import { DatabasesService } from './databases.service';
import { DatabasesController } from './databases.controller';
import { BullModule } from '@nestjs/bullmq';
import { DatabasesQueue } from '@nuvix/core/resolvers/queues/databases.queue';
import { QueueFor } from '@nuvix/utils';

@Module({
  controllers: [DatabasesController],
  providers: [DatabasesService, DatabasesQueue],
  imports: [
    BullModule.registerQueue(
      {
        name: QueueFor.DATABASES,
        defaultJobOptions: {
          removeOnComplete: true,
          attempts: 2,
        },
      },
      { name: QueueFor.STATS },
    ),
  ],
})
export class DatabasesModule {}
