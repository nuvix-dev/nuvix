import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ProjectService } from './projects.service'
import { ProjectsController } from './projects.controller'
import { JwtModule } from '@nestjs/jwt'
import { configuration, QueueFor } from '@nuvix/utils'
import { ProjectController } from './project.controller'
import { BullModule } from '@nestjs/bullmq'
import { ProjectsQueue } from '@nuvix/core/resolvers/queues/projects.queue'
import { AuthSettingsController } from './auth-settings/auth-settings.controller'
import { KeysController } from './keys/keys.controller'
import { PlatformsController } from './platforms/platforms.controller'
import { TemplatesController } from './templates/templates.controller'
import { WebhooksController } from './webhooks/webhooks.controller'
import { AuthSettingsService } from './auth-settings/auth-settings.service'
import { KeysService } from './keys/keys.service'
import { PlatformsService } from './platforms/platforms.service'
import { TemplatesService } from './templates/templates.service'
import { WebhooksService } from './webhooks/webhooks.service'
import { AuthHook, ApiHook, AuditHook } from '@nuvix/core/resolvers'
import { MetadataService } from './metadata/metadata.service'
import { MetadataController } from './metadata/metadata.controller'

@Module({
  imports: [
    JwtModule.register({
      secret: configuration.security.jwtSecret,
      signOptions: { expiresIn: '15m' },
    }),
    BullModule.registerQueue(
      {
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
      },
      { name: QueueFor.MAILS },
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
    ),
  ],
  providers: [
    ProjectService,
    ProjectsQueue,
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
