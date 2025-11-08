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
import { CoreModule } from '@nuvix/core/core.module'
import { MailsQueue } from '@nuvix/core/resolvers/queues'
import { BullModule } from '@nestjs/bullmq'
import { ScheduleModule } from '@nestjs/schedule'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { configuration, QueueFor } from '@nuvix/utils'
import {
  HostHook,
  AuthHook,
  CorsHook,
  ApiHook,
} from '@nuvix/core/resolvers/hooks'
import { ProjectHook } from './resolvers/hooks/project.hook'
import { PgMetaModule } from '@nuvix/pg-meta'
import { AccountController } from './account/account.controller'
import { AuditHook } from '@nuvix/core/resolvers/hooks/audit.hook'
import { AuditsQueue } from './resolvers/queues/audits.queue'
import { Key } from '@nuvix/core/helper/key.helper'
import { CoreService } from '@nuvix/core'
import { CliModule } from './cli/cli.module'
import { CliController } from './cli/cli.controller'
import { TeamsModule } from './teams/teams.module'

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
    TeamsModule,
    ProjectModule,
    PgMetaModule,
    CliModule,
  ],
  controllers: [AppController],
  providers: [AppService, MailsQueue, AuditsQueue],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(private readonly jwtService: JwtService) {
    CoreService.isPlatform = true
  }

  onModuleInit() {
    Key.setJwtService(this.jwtService)
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProjectHook, HostHook, CorsHook)
      .forRoutes('*')
      .apply(AuthHook, ApiHook, AuditHook)
      .forRoutes(AccountController, CliController)
  }
}
