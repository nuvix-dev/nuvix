import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { AccountModule } from './account/account.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectModule } from './projects/project.module';
import { CoreModule } from '@nuvix/core/core.module';
import { MailsQueue } from '@nuvix/core/resolvers/queues';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JWT_SECRET, QueueFor } from '@nuvix/utils';
import {
  HostHook,
  AuthHook,
  CorsHook,
  ApiHook,
} from '@nuvix/core/resolvers/hooks';
import { ProjectHook } from './resolvers/hooks/project.hook';
import { PgMetaController, PgMetaModule } from '@nuvix/pg-meta';
import { AccountController } from './account/account.controller';
import { OrganizationsController } from './organizations/organizations.controller';
import { ProjectController } from './projects/project.controller';
import { ProjectsController } from './projects/projects.controller';
import { AuditHook } from '@nuvix/core/resolvers/hooks/audit.hook';
import { AuditsQueue } from './resolvers/queues/audits.queue';
import { Key } from '@nuvix/core/helper/key.helper';
import { AppConfigService } from '@nuvix/core';
import { CliModule } from './cli/cli.module';
import { CliController } from './cli/cli.controller';

@Module({
  imports: [
    CoreModule,
    BullModule.forRootAsync({
      useFactory(config: AppConfigService) {
        const redisConfig = config.getRedisConfig();
        return {
          connection: {
            ...redisConfig,
            tls: redisConfig.secure
              ? {
                  rejectUnauthorized: false,
                }
              : undefined,
          },
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: true,
          },
          prefix: 'nuvix', // TODO: we have to include a instance key that must be unique per app instance
        };
      },
      inject: [AppConfigService],
    }),
    BullModule.registerQueue(
      { name: QueueFor.MAILS },
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
    ),
    EventEmitterModule.forRoot({
      global: true,
    }),
    ScheduleModule.forRoot(),
    JwtModule.register({
      secret: JWT_SECRET,
      global: true,
    }),
    AccountModule,
    OrganizationsModule,
    ProjectModule,
    PgMetaModule,
    CliModule,
  ],
  controllers: [AppController],
  providers: [AppService, MailsQueue, AuditsQueue],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(private readonly jwtService: JwtService) {}

  onModuleInit() {
    Key.setJwtService(this.jwtService);
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProjectHook, HostHook, CorsHook)
      .forRoutes('*')
      .apply(AuthHook, ApiHook, AuditHook)
      .forRoutes(
        AccountController,
        OrganizationsController,
        ProjectController,
        ProjectsController,
        PgMetaController,
        CliController,
      );
  }
}
