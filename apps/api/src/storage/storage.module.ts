import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { BullModule } from '@nestjs/bullmq';
import { QueueFor } from '@nuvix/utils';

@Module({
  imports: [BullModule.registerQueue({ name: QueueFor.STATS })],
  controllers: [StorageController],
  providers: [StorageService],
})
export class StorageModule {}
