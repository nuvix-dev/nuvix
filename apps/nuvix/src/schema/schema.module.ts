import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SchemaService } from './schema.service';
import { SchemaController } from './schema.controller';
import { SchemaHook } from '@nuvix/core/resolvers/hooks/schema.hook';
import { BullModule } from '@nestjs/bullmq';
import { SchemaQueue } from '@nuvix/core/resolvers/queues/schema.queue';

@Module({
  controllers: [SchemaController],
  providers: [SchemaService, SchemaQueue],
  imports: [
    BullModule.registerQueue({
      name: 'schema',
      defaultJobOptions: {
        removeOnComplete: true,
        attempts: 2,
      },
    }),
  ],
})
export class SchemaModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SchemaHook).forRoutes(SchemaController);
  }
}
