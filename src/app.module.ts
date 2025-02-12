import { Logger, MiddlewareConsumer, Module } from '@nestjs/common';
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
import { ClsModule } from 'nestjs-cls';
import { Request } from 'express';
import { FunctionsModule } from './functions/functions.module';
import { AuthMiddleware } from './core/resolver/middlewares/auth.middleware';
import { CoreModule } from './core/core.module';
import { ProjectMiddleware } from './core/resolver/middlewares/project.middleware';
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
} from './Utils/constants';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { StorageModule } from './storage/storage.module';
import { JwtModule } from '@nestjs/jwt';
import { MailQueue } from './core/resolver/queues/mail.queue';
import { ApiMiddleware } from './core/resolver/middlewares/api.middleware';
config();

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup(cls, req: Request, res) {
          cls.set('req', req);
          cls.set('res', res);
          cls.set('logger', new Logger('NUVIX'));
        },
      },
    }),
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
    BullModule.registerQueue({ name: 'mails' }),
    EventEmitterModule.forRoot({
      global: true,
    }),
    JwtModule.register({
      secret: JWT_SECRET,
      global: true,
    }),
    CoreModule,
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
export class AppModule {
  async configure(consumer: MiddlewareConsumer) {

    consumer
      .apply(ProjectMiddleware)
      .forRoutes('*')
      .apply(AuthMiddleware)
      .forRoutes('*')
      .apply(ApiMiddleware)
      .forRoutes('*');
  }
}
