import { Module } from '@nestjs/common';
import { FunctionsService } from './functions.service';
import { FunctionsController } from './functions.controller';
import { BullModule } from '@nestjs/bullmq';
import { QueueFor } from '@nuvix/utils';

@Module({
  imports: [BullModule.registerQueue({ name: QueueFor.STATS })],
  controllers: [FunctionsController],
  providers: [FunctionsService],
})
export class FunctionsModule {}
