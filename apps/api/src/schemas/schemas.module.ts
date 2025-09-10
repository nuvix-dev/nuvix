import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SchemasService } from './schemas.service';
import { SchemasController } from './schemas.controller';
import { SchemaHook } from '@nuvix/core/resolvers/hooks/schema.hook';
import { CollectionsModule } from './collections/collections.module';
import { BullModule } from '@nestjs/bullmq';
import { QueueFor } from '@nuvix/utils';
import { AuthHook, ApiHook, StatsHook, AuditHook } from '@nuvix/core/resolvers';

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
      .forRoutes(SchemasController);
  }
}
