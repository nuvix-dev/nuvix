import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ApiHook, AuditHook, AuthHook, StatsHook } from '@nuvix/core/resolvers'
import { AvatarsController } from './avatars.controller'
import { AvatarsService } from './avatars.service'

@Module({
  controllers: [AvatarsController],
  providers: [AvatarsService],
})
export class AvatarsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthHook, ApiHook, StatsHook, AuditHook)
      .forRoutes(AvatarsController)
  }
}
