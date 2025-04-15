import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseQueue } from '@nuvix/core/resolvers/queues/database.queue';
import { DatabaseHook } from '@nuvix/core/resolvers/hooks/database.hook';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'database',
    }),
  ],
  controllers: [DatabaseController],
  providers: [DatabaseService, DatabaseQueue],
})
export class DatabaseModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DatabaseHook).forRoutes(DatabaseController);
  }
}
