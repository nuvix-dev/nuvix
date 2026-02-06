import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ApiHook, AuthHook } from '@nuvix/core/resolvers'
import { ResolveClient } from './hooks'
import { PgMetaController } from './pg-meta.controller'
import { PgMetaService } from './pg-meta.service'

@Module({
  providers: [PgMetaService],
  exports: [PgMetaService],
  controllers: [PgMetaController],
})
export class PgMetaModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthHook, ApiHook, ResolveClient).forRoutes(PgMetaController)
  }
}
