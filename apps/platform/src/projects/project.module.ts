import { BullModule } from '@nestjs/bullmq'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ApiHook, AuditHook, AuthHook } from '@nuvix/core/resolvers'
import { QueueFor } from '@nuvix/utils'
import { AuthSettingsController } from './auth-settings/auth-settings.controller'
import { AuthSettingsService } from './auth-settings/auth-settings.service'
import { KeysController } from './keys/keys.controller'
import { KeysService } from './keys/keys.service'
import { MetadataController } from './metadata/metadata.controller'
import { MetadataService } from './metadata/metadata.service'
import { PlatformsController } from './platforms/platforms.controller'
import { PlatformsService } from './platforms/platforms.service'
import { ProjectController } from './project.controller'
import { ProjectsController } from './projects.controller'
import { ProjectService } from './projects.service'
import { TemplatesController } from './templates/templates.controller'
import { TemplatesService } from './templates/templates.service'
import { WebhooksController } from './webhooks/webhooks.controller'
import { WebhooksService } from './webhooks/webhooks.service'

@Module({
  imports: [
    BullModule.registerQueue({
      name: QueueFor.PROJECTS,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 1,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
  ],
  providers: [
    ProjectService,
    AuthSettingsService,
    KeysService,
    PlatformsService,
    TemplatesService,
    WebhooksService,
    MetadataService,
  ],
  controllers: [
    ProjectsController,
    ProjectController,
    AuthSettingsController,
    KeysController,
    PlatformsController,
    TemplatesController,
    WebhooksController,
    MetadataController,
  ],
})
export class ProjectModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthHook, ApiHook, AuditHook)
      .forRoutes(
        ProjectsController,
        ProjectController,
        AuthSettingsController,
        KeysController,
        PlatformsController,
        TemplatesController,
        WebhooksController,
        MetadataController,
      )
  }
}
