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
import {
  ApiHook,
  AuditHook,
  AuthHook,
  CorsHook,
  HostHook,
  MailsQueue,
} from '@nuvix/core/resolvers'
import { PgMetaModule } from '@nuvix/pg-meta'
import { configuration, QueueFor } from '@nuvix/utils'
import { AccountController } from './account/account.controller'
import { AccountModule } from './account/account.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ProjectModule } from './projects/project.module'
import { ProjectHook } from './resolvers/hooks/project.hook'
import { AuditsQueue } from './resolvers/queues/audits.queue'

@Module({
  imports: [
    CoreModule,
    BullModule.registerQueue(
      { name: QueueFor.MAILS },
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
    ),
    ScheduleModule.forRoot(),
    JwtModule.register({
      secret: configuration.security.jwtSecret,
      global: true,
    }),
    AccountModule,
    ProjectModule,
    PgMetaModule,
  ],
  controllers: [AppController],
  providers: [AppService, MailsQueue, AuditsQueue],
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
      .apply(AuthHook, ApiHook, AuditHook)
      .forRoutes(AccountController)
  }
}
