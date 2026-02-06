import { BullModule } from '@nestjs/bullmq'
import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common'
import { ApiHook, AuditHook, AuthHook, StatsHook } from '@nuvix/core/resolvers'
import { QueueFor } from '@nuvix/utils'
import { FilesController } from './files/files.controller'
import { FilesService } from './files/files.service'
import { StorageController } from './storage.controller'
import { StorageService } from './storage.service'

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
