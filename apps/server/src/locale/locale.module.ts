import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QueueFor } from '@nuvix/utils'
import { AuthHook, ApiHook, StatsHook, AuditHook } from '@nuvix/core/resolvers'
import { LocaleController } from './locale.controller'
import { LocaleService } from './locale.service'

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
    ),
  ],
  controllers: [LocaleController],
  providers: [LocaleService],
})
export class LocaleModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthHook, ApiHook, StatsHook, AuditHook)
      .forRoutes(LocaleController)
  }
}
