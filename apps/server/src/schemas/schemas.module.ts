import { BullModule } from '@nestjs/bullmq'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import {
  ApiHook,
  AuditHook,
  AuthHook,
  SchemaHook,
  StatsHook,
} from '@nuvix/core/resolvers'
import { QueueFor } from '@nuvix/utils'
import { CollectionsModule } from './collections/collections.module'
import { SchemasController } from './schemas.controller'
import { SchemasService } from './schemas.service'

@Module({
  imports: [
    CollectionsModule,
    BullModule.registerQueue(
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
    ),
  ],
  controllers: [SchemasController],
  providers: [SchemasService],
})
export class SchemasModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthHook, ApiHook, SchemaHook, StatsHook, AuditHook)
      .forRoutes(SchemasController)
  }
}
