import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common'
import { SchemaHook } from '@nuvix/core/resolvers'
import { AttributesController } from './attributes/attributes.controller'
import { AttributesService } from './attributes/attributes.service'
import { CollectionsController } from './collections.controller'
import { CollectionsService } from './collections.service'
import { DocumentsController } from './documents/documents.controller'
import { DocumentsService } from './documents/documents.service'
import { IndexesController } from './indexes/indexes.controller'
import { IndexesService } from './indexes/indexes.service'

@Module({
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
  ],
})
export class CollectionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SchemaHook)
      .forRoutes(
        CollectionsController,
        AttributesController,
        IndexesController,
        DocumentsController,
      )
  }
}
