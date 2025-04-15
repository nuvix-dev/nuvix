import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConsoleService } from './console.service';
import { ConsoleController } from './console.controller';
import { AccountModule } from './account/account.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectModule } from './projects/project.module';
import { CoreModule } from '@nuvix/core/core.module';
import { MailQueue } from '@nuvix/core/resolvers/queues';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
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
} from '@nuvix/utils/constants';
import { ProjectHook, HostHook, AuthHook } from '@nuvix/core/resolvers/hooks';

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
    UsersModule,
    AccountModule,
    OrganizationsModule,
    ProjectModule,
  ],
  controllers: [ConsoleController],
  providers: [ConsoleService, MailQueue],
})
export class ConsoleModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProjectHook, HostHook)
      .forRoutes('*')
      .apply(AuthHook)
      .forRoutes('*');
  }
}
