import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { QueueFor } from '@nuvix/utils'
import { AccountController } from './account.controller'
import { AccountService } from './account.service'

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: QueueFor.MAILS,
      },
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
      { name: QueueFor.DELETES },
    ),
  ],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
