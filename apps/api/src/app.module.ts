import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MailsQueue } from '@nuvix/core/resolvers/queues/mails.queue';
import { AuditsQueue } from '@nuvix/core/resolvers/queues/audits.queue';
import { JWT_SECRET, QueueFor } from '@nuvix/utils';
// Hooks
import {
  ApiHook,
  AuthHook,
  CorsHook,
  HostHook,
  ProjectHook,
  StatsHook,
  AuditHook,
} from '@nuvix/core/resolvers/hooks';
// Modules
import { JwtModule, JwtService } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from '@nuvix/core/core.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BaseModule } from './base/base.module';
import { DatabasesModule } from './databases/databases.module';
import { AvatarsModule } from './avatars/avatars.module';
import { UsersModule } from './users/users.module';
import { AccountModule } from './account/account.module';
import { TeamsModule } from './teams/teams.module';
import { RealtimeModule } from './realtime/realtime.module';
import { FunctionsModule } from './functions/functions.module';
import { StorageModule } from './storage/storage.module';
import { MessagingModule } from './messaging/messaging.module';
import { SchemasModule } from './schemas/schemas.module';
// Controllers
import { BaseController } from './base/base.controller';
import { UsersController } from './users/users.controller';
import { TeamsController } from './teams/teams.controller';
import { AccountController } from './account/account.controller';
import { AvatarsController } from './avatars/avatars.controller';
import { FunctionsController } from './functions/functions.controller';
import { SchemasController } from './schemas/schemas.controller';
import { StorageController } from './storage/storage.controller';
import { MessagingController } from './messaging/messaging.controller';
import { DatabasesController } from './databases/databases.controller';

import { Key } from '@nuvix/core/helper/key.helper';
import { StatsQueue } from '@nuvix/core/resolvers/queues';
import { AppConfigService } from '@nuvix/core';
import { CollectionsController } from './schemas/collections/collections.controller';

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
            enableOfflineQueue: false, // Disable offline queue to avoid job accumulation when Redis is down
            enableReadyCheck: true,
          },
          defaultJobOptions: {
            priority: 1,
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: true,
          },
          prefix: 'nuvix', // TODO: we have to include a instance key that should be unique per app instance
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
    BaseModule,
    UsersModule,
    TeamsModule,
    AccountModule,
    DatabasesModule,
    AvatarsModule,
    RealtimeModule,
    FunctionsModule,
    StorageModule,
    SchemasModule,
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [AppService, MailsQueue, AuditsQueue, StatsQueue],
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
      .apply(AuthHook, ApiHook, StatsHook)
      .forRoutes(
        BaseController,
        UsersController,
        TeamsController,
        AccountController,
        DatabasesController,
        AvatarsController,
        FunctionsController,
        SchemasController,
        StorageController,
        MessagingController,
        CollectionsController,
      )
      .apply(AuditHook)
      .forRoutes(
        UsersController,
        TeamsController,
        AccountController,
        DatabasesController,
        FunctionsController,
        SchemasController,
        StorageController,
        MessagingController,
        CollectionsController,
      );
  }
}
