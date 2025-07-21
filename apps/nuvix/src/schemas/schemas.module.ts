import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SchemasService } from './schemas.service';
import { SchemasController } from './schemas.controller';
import { SchemaHook } from '@nuvix/core/resolvers/hooks/schema.hook';
import { CollectionsModule } from './collections/collections.module';
import { CollectionsController } from './collections/collections.controller';

@Module({
  imports: [CollectionsModule],
  controllers: [SchemasController],
  providers: [SchemasService],
})
export class SchemasModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SchemaHook).forRoutes(SchemasController, CollectionsController);
  }
}
