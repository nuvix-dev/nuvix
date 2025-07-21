// TODO: remove this module
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';
import { SchemaHook } from '@nuvix/core/resolvers/hooks/schema.hook';
import { BullModule } from '@nestjs/bullmq';
import { DatabasesQueue } from '@nuvix/core/resolvers/queues/databases.queue';
import { QueueFor } from '@nuvix/utils/constants';

@Module({
  controllers: [DatabaseController],
  providers: [DatabaseService, DatabasesQueue],
  imports: [
    BullModule.registerQueue({
      name: QueueFor.DATABASES,
      defaultJobOptions: {
        removeOnComplete: true,
        attempts: 2,
      },
    }),
  ],
})
export class DatabaseModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SchemaHook).forRoutes(DatabaseController);
  }
}
