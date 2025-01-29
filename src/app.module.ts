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
import { APP_REDIS_PORT, APP_REDIS_URL } from './Utils/constants';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
        path: APP_REDIS_URL,
        port: APP_REDIS_PORT,
        skipVersionCheck: true,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
    EventEmitterModule.forRoot({
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes('*')
      .apply(ProjectMiddleware)
      .forRoutes('*');
  }
}
