import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ApiHook, AuditHook, AuthHook, StatsHook } from '@nuvix/core/resolvers'
import { DatabaseController } from './database.controller'
import { DatabaseService } from './database.service'

@Module({
  controllers: [DatabaseController],
  providers: [DatabaseService],
})
export class DatabaseModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthHook, ApiHook, StatsHook, AuditHook)
      .forRoutes(DatabaseController)
  }
}
