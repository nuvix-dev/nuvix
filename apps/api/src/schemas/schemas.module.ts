import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SchemasService } from './schemas.service';
import { SchemasController } from './schemas.controller';
import { SchemaHook } from '@nuvix/core/resolvers/hooks/schema.hook';
import { CollectionsModule } from './collections/collections.module';
import { CollectionsController } from './collections/collections.controller';
import { BullModule } from '@nestjs/bullmq';
import { QueueFor } from '@nuvix/utils';

@Module({
  imports: [
    CollectionsModule,
    BullModule.registerQueue({ name: QueueFor.STATS }),
  ],
  controllers: [SchemasController],
  providers: [SchemasService],
})
export class SchemasModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SchemaHook)
      .forRoutes(SchemasController, CollectionsController);
  }
}
