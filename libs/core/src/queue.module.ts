import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QueueFor } from '@nuvix/utils'

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QueueFor.MAILS },
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
      { name: QueueFor.LOGS },
      { name: QueueFor.DELETES },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
