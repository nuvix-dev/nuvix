import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CollectionsQueue } from '@nuvix/core/resolvers/queues';
import { QueueFor } from '@nuvix/utils';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QueueFor.COLLECTIONS,
    }),
  ],
  controllers: [CollectionsController],
  providers: [CollectionsService, CollectionsQueue],
})
export class CollectionsModule {}
