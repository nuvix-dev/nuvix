import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MailQueue } from '@nuvix/core/resolvers/queues/mail.queue';
// Constants
import {
  APP_REDIS_DB,
  APP_REDIS_HOST,
  APP_REDIS_PASSWORD,
  APP_REDIS_PORT,
  APP_REDIS_SECURE,
  APP_REDIS_USER,
  JWT_SECRET,
  WORKER_TYPE_MAILS,
  WORKER_TYPE_USAGE,
} from '@nuvix/utils/constants';
// Hooks
import {
  ApiHook,
  AuthHook,
  CorsHook,
  HostHook,
  ProjectHook,
  ProjectUsageHook,
} from '@nuvix/core/resolvers/hooks';
// Modules
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from '@nuvix/core/core.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BaseModule } from './base/base.module';
import { DatabaseModule } from './database/database.module';
import { AvatarsModule } from './avatars/avatars.module';
import { UsersModule } from './users/users.module';
import { AccountModule } from './account/account.module';
import { TeamsModule } from './teams/teams.module';
import { RealtimeModule } from './realtime/realtime.module';
import { FunctionsModule } from './functions/functions.module';
import { StorageModule } from './storage/storage.module';
import { MessagingModule } from './messaging/messaging.module';
// Controllers
import { SchemaModule } from './schema/schema.module';
import { BaseController } from './base/base.controller';
import { UsersController } from './users/users.controller';
import { TeamsController } from './teams/teams.controller';
import { AccountController } from './account/account.controller';
import { DatabaseController } from './database/database.controller';
import { AvatarsController } from './avatars/avatars.controller';
import { FunctionsController } from './functions/functions.controller';
import { SchemaController } from './schema/schema.controller';
import { StorageController } from './storage/storage.controller';
import { MessagingController } from './messaging/messaging.controller';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        port: APP_REDIS_PORT,
        host: APP_REDIS_HOST,
        username: APP_REDIS_USER,
        password: APP_REDIS_PASSWORD,
        db: APP_REDIS_DB,
        tls: APP_REDIS_SECURE ? {} : undefined,
        enableOfflineQueue: false, // Disable offline queue to avoid job accumulation when Redis is down
        enableReadyCheck: true, // Ensure the connection is ready before processing jobs
      },
      defaultJobOptions: {
        priority: 1,
        attempts: 3, 
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
      prefix: 'nuvix',
    }),
    BullModule.registerQueue(
      { name: WORKER_TYPE_MAILS },
      { name: WORKER_TYPE_USAGE },
    ),
    EventEmitterModule.forRoot({
      global: true,
    }),
    ScheduleModule.forRoot(),
    JwtModule.register({
      secret: JWT_SECRET,
      global: true,
    }),
    CoreModule,
    BaseModule,
    UsersModule,
    TeamsModule,
    AccountModule,
    DatabaseModule,
    AvatarsModule,
    RealtimeModule,
    FunctionsModule,
    StorageModule,
    SchemaModule,
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [AppService, MailQueue],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProjectHook, HostHook, CorsHook)
      .forRoutes(
        BaseController,
        UsersController,
        TeamsController,
        AccountController,
        DatabaseController,
        AvatarsController,
        FunctionsController,
        SchemaController,
        StorageController,
        MessagingController,
      )
      .apply(AuthHook, ApiHook, ProjectUsageHook)
      .forRoutes(
        BaseController,
        UsersController,
        TeamsController,
        AccountController,
        DatabaseController,
        AvatarsController,
        FunctionsController,
        SchemaController,
        StorageController,
        MessagingController,
      );
  }
}
