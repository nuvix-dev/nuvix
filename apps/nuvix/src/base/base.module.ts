import { Module } from '@nestjs/common';
import { BaseController } from './base.controller';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [BullModule.registerQueue({ name: 'mails' })],
  controllers: [BaseController],
})
export class BaseModule {}
