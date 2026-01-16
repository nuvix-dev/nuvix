import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { DatabaseController } from './database.controller'
import { BullModule } from '@nestjs/bullmq'
import { DatabaseQueue } from '@nuvix/core/resolvers'
import { QueueFor } from '@nuvix/utils'
import { AuthHook, ApiHook, StatsHook, AuditHook } from '@nuvix/core/resolvers'

@Module({
  controllers: [DatabaseController],
  providers: [DatabaseService, DatabaseQueue],
  imports: [
    BullModule.registerQueue(
      {
        name: QueueFor.DATABASE,
        defaultJobOptions: {
          removeOnComplete: true,
          attempts: 2,
        },
      },
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
    ),
  ],
})
export class DatabaseModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthHook, ApiHook, StatsHook, AuditHook)
      .forRoutes(DatabaseController)
  }
}
