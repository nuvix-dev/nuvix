import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ApiHook, AuditHook, AuthHook, StatsHook } from '@nuvix/core/resolvers'
import { LocaleController } from './locale.controller'
import { LocaleService } from './locale.service'

@Module({
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
