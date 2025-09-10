import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CollectionsQueue } from '@nuvix/core/resolvers/queues';
import { QueueFor } from '@nuvix/utils';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import {
  AuthHook,
  ApiHook,
  StatsHook,
  AuditHook,
  SchemaHook,
} from '@nuvix/core/resolvers';
import { DocumentsController } from './documents/documents.controller';
import { AttributesController } from './attributes/attributes.controller';
import { IndexesController } from './indexes/indexes.controller';
import { AttributesService } from './attributes/attributes.service';
import { IndexesService } from './indexes/indexes.service';
import { DocumentsService } from './documents/documents.service';

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
      );
  }
}
