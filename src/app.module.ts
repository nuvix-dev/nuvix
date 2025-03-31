import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { config } from 'dotenv';
import { BaseModule } from './base/base.module';
import { DatabaseModule } from './database/database.module';
import { ConsoleModule } from './console/console.module';
import { AvatarsModule } from './avatars/avatars.module';
import { UsersModule } from './users/users.module';
import { AccountModule } from './account/account.module';
import { TeamsModule } from './teams/teams.module';
import { RealtimeModule } from './realtime/realtime.module';
import { FunctionsModule } from './functions/functions.module';
import { CoreModule } from './core/core.module';
import { BullModule } from '@nestjs/bullmq';
import {
  APP_REDIS_DB,
  APP_REDIS_HOST,
  APP_REDIS_PASSWORD,
  APP_REDIS_PATH,
  APP_REDIS_PORT,
  APP_REDIS_SECURE,
  APP_REDIS_USER,
  JWT_SECRET,
  WORKER_TYPE_MAILS,
  WORKER_TYPE_USAGE,
} from './Utils/constants';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { StorageModule } from './storage/storage.module';
import { JwtModule } from '@nestjs/jwt';
import { MailQueue } from './core/resolvers/queues/mail.queue';
import { ScheduleModule } from '@nestjs/schedule';
import {
  ApiHook,
  AuthHook,
  CorsHook,
  HostHook,
  ProjectHook,
  ProjectUsageHook,
} from './core/resolvers/hooks';
config();

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        path: APP_REDIS_PATH,
        port: APP_REDIS_PORT,
        host: APP_REDIS_HOST,
        username: APP_REDIS_USER,
        password: APP_REDIS_PASSWORD,
        db: APP_REDIS_DB,
        tls: APP_REDIS_SECURE ? {} : undefined,
      },
      defaultJobOptions: {
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
    // HookModule,
    BaseModule,
    ConsoleModule,
    UsersModule,
    TeamsModule,
    AccountModule,
    DatabaseModule,
    AvatarsModule,
    RealtimeModule,
    FunctionsModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [AppService, MailQueue],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProjectHook, HostHook, CorsHook)
      .forRoutes('*')
      .apply(AuthHook, ApiHook, ProjectUsageHook)
      .forRoutes('*');
  }
}
