import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { SchemaHook } from '@nuvix/core/resolvers'
import { CollectionsModule } from './collections/collections.module'
import { SchemasController } from './schemas.controller'
import { SchemasService } from './schemas.service'

@Module({
  imports: [CollectionsModule],
  controllers: [SchemasController],
  providers: [SchemasService],
})
export class SchemasModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SchemaHook).forRoutes(SchemasController)
  }
}
