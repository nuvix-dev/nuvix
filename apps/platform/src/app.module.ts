import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from '@nestjs/common'
import { AppService } from './app.service'
import { AppController } from './app.controller'
import { AccountModule } from './account/account.module'
import { ProjectModule } from './projects/project.module'
import { CoreModule } from '@nuvix/core'
import { MailsQueue } from '@nuvix/core/resolvers'
import { BullModule } from '@nestjs/bullmq'
import { ScheduleModule } from '@nestjs/schedule'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { configuration, QueueFor } from '@nuvix/utils'
import { HostHook, AuthHook, CorsHook, ApiHook } from '@nuvix/core/resolvers'
import { ProjectHook } from './resolvers/hooks/project.hook'
import { PgMetaModule } from '@nuvix/pg-meta'
import { AccountController } from './account/account.controller'
import { AuditHook } from '@nuvix/core/resolvers'
import { AuditsQueue } from './resolvers/queues/audits.queue'
import { Key } from '@nuvix/core/helpers'
import { CoreService } from '@nuvix/core'

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
