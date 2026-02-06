// Modules
import { BullModule } from '@nestjs/bullmq'
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { ScheduleModule } from '@nestjs/schedule'
import { CoreModule } from '@nuvix/core'
import { Key } from '@nuvix/core/helpers'
// Hooks
import {
  ApiLogsQueue,
  AuditsQueue,
  CorsHook,
  HostHook,
  LogsHook,
  MailsQueue,
  ProjectHook,
  StatsQueue,
} from '@nuvix/core/resolvers'
import { configuration, QueueFor } from '@nuvix/utils'
import { AccountModule } from './account/account.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AvatarsModule } from './avatars/avatars.module'
import { DatabaseModule } from './database/database.module'
import { LocaleModule } from './locale/locale.module'
import { MessagingModule } from './messaging/messaging.module'
import { SchemasModule } from './schemas/schemas.module'
import { StorageModule } from './storage/storage.module'
import { TeamsModule } from './teams/teams.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    CoreModule,
    BullModule.registerQueue(
      { name: QueueFor.MAILS },
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
      { name: QueueFor.LOGS },
    ),
    ScheduleModule.forRoot(),
    JwtModule.register({
      secret: configuration.security.jwtSecret,
      global: true,
    }),
    UsersModule,
    TeamsModule,
    AccountModule,
    DatabaseModule,
    AvatarsModule,
    StorageModule,
    SchemasModule,
    MessagingModule,
    LocaleModule,
  ],
  controllers: [AppController],
  providers: [AppService, MailsQueue, AuditsQueue, StatsQueue, ApiLogsQueue],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(private readonly jwtService: JwtService) {}

  onModuleInit() {
    Key.setJwtService(this.jwtService)
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProjectHook, HostHook, CorsHook)
      .forRoutes('*')
      .apply(...(configuration.app.enableLogs ? [LogsHook] : []))
      .forRoutes('*')
  }
}
