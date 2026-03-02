import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QueueFor } from '@nuvix/utils'
import { CoreService } from './core.service'

@Module({
  imports: [
    BullModule.registerQueueAsync(
      { name: QueueFor.AUDITS },
      ...(!CoreService.isConsole()
        ? [
            { name: QueueFor.MAILS },
            { name: QueueFor.STATS },
            { name: QueueFor.LOGS },
            { name: QueueFor.DELETES },
            { name: QueueFor.MESSAGING },
          ]
        : []),
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
