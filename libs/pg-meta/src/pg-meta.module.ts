import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PgMetaService } from './pg-meta.service';
import { PgMetaController } from './pg-meta.controller';
import { ResolveClient } from './hooks';

@Module({
  providers: [PgMetaService],
  exports: [PgMetaService],
  controllers: [PgMetaController],
})
export class PgMetaModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ResolveClient).forRoutes(PgMetaController);
  }
}
