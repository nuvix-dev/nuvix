import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { BullModule } from '@nestjs/bullmq';
import { QueueFor } from '@nuvix/utils';

@Module({
  imports: [BullModule.registerQueue({ name: QueueFor.MAILS })],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
