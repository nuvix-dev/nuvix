import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { BullModule } from '@nestjs/bullmq';
import { QueueFor } from '@nuvix/utils';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QueueFor.MAILS },
      { name: QueueFor.STATS },
    ),
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
