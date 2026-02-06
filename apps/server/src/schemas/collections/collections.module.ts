import { BullModule } from '@nestjs/bullmq'
import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common'
import {
  ApiHook,
  AuditHook,
  AuthHook,
  CollectionsQueue,
  SchemaHook,
  StatsHook,
} from '@nuvix/core/resolvers'
import { QueueFor } from '@nuvix/utils'
import { AttributesController } from './attributes/attributes.controller'
import { AttributesService } from './attributes/attributes.service'
import { CollectionsController } from './collections.controller'
import { CollectionsService } from './collections.service'
import { DocumentsController } from './documents/documents.controller'
import { DocumentsService } from './documents/documents.service'
import { IndexesController } from './indexes/indexes.controller'
import { IndexesService } from './indexes/indexes.service'

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: QueueFor.COLLECTIONS,
      },
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
    ),
  ],
  controllers: [
    CollectionsController,
    AttributesController,
    IndexesController,
    DocumentsController,
  ],
  providers: [
    CollectionsService,
    AttributesService,
    IndexesService,
    DocumentsService,
    CollectionsQueue,
  ],
})
export class CollectionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthHook, ApiHook, SchemaHook, StatsHook, AuditHook)
      .forRoutes(
        CollectionsController,
        AttributesController,
        IndexesController,
        DocumentsController,
      )
  }
}
