import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { BullModule } from '@nestjs/bullmq';
import { WORKER_TYPE_MAILS } from '@nuvix/utils/constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: WORKER_TYPE_MAILS,
    }),
  ],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
