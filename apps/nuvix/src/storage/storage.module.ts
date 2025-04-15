import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { StorageHook } from '@nuvix/core/resolvers/hooks/storage.hook';

@Module({
  controllers: [StorageController],
  providers: [StorageService],
})
export class StorageModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(StorageHook).forRoutes(StorageController);
  }
}
