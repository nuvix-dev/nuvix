import { Module } from '@nestjs/common';
import { BaseController } from './base.controller';
import { BullModule } from '@nestjs/bullmq';
import { QueueFor } from '@nuvix/utils';

@Module({
  imports: [BullModule.registerQueue({ name: QueueFor.MAILS })],
  controllers: [BaseController],
})
export class BaseModule {}
