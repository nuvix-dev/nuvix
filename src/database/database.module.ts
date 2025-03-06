import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseQueue } from 'src/core/resolvers/queues/database.queue';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'database',
    }),
  ],
  controllers: [DatabaseController],
  providers: [DatabaseService, DatabaseQueue],
})
export class DatabaseModule {}
