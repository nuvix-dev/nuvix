import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';

@Module({
  controllers: [MessagingController],
  providers: [MessagingService],
})
export class MessagingModule {}
