import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [BullModule.registerQueue({ name: 'mails' })],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
