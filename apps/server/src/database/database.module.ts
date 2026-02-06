import { BullModule } from '@nestjs/bullmq'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import {
  ApiHook,
  AuditHook,
  AuthHook,
  DatabaseQueue,
  StatsHook,
} from '@nuvix/core/resolvers'
import { QueueFor } from '@nuvix/utils'
import { DatabaseController } from './database.controller'
import { DatabaseService } from './database.service'

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
