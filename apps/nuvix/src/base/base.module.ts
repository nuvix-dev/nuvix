import { Module } from '@nestjs/common';
import { BaseService } from './base.service';
import { BaseResolver } from './base.resolver';
import { BaseController } from './base.controller';
import { BullModule } from '@nestjs/bullmq';

@Module({
  providers: [BaseResolver, BaseService],
  imports: [BullModule.registerQueue({ name: 'mails' })],
  controllers: [BaseController],
})
export class BaseModule {}
