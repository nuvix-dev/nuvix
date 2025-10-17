import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common'
import { StorageService } from './storage.service'
import { StorageController } from './storage.controller'
import { BullModule } from '@nestjs/bullmq'
import { QueueFor } from '@nuvix/utils'
import { AuthHook, ApiHook, StatsHook, AuditHook } from '@nuvix/core/resolvers'
import { FilesController } from './files/files.controller'
import { FilesService } from './files/files.service'

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
      { name: QueueFor.DELETES },
    ),
  ],
  controllers: [StorageController, FilesController],
  providers: [StorageService, FilesService],
})
export class StorageModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthHook, ApiHook, StatsHook, AuditHook)
      .forRoutes(StorageController, FilesController)
  }
}
