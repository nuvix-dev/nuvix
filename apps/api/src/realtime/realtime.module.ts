import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  providers: [RealtimeGateway, RealtimeService],
})
export class RealtimeModule {}
