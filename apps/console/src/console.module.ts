import { MiddlewareConsumer, Module, NestModule, OnModuleInit } from '@nestjs/common';
import { ConsoleService } from './console.service';
import { ConsoleController } from './console.controller';
import { AccountModule } from './account/account.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectModule } from './projects/project.module';
import { CoreModule } from '@nuvix/core/core.module';
import { MailsQueue } from '@nuvix/core/resolvers/queues';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule, JwtService } from '@nestjs/jwt';
import {
  APP_REDIS_DB,
  APP_REDIS_HOST,
  APP_REDIS_PASSWORD,
  APP_REDIS_PORT,
  APP_REDIS_SECURE,
  APP_REDIS_USER,
  JWT_SECRET,
  QueueFor,
} from '@nuvix/utils/constants';
import { HostHook, AuthHook, ApiHook } from '@nuvix/core/resolvers/hooks';
import { ProjectHook } from './resolvers/hooks/project.hook';
import { ProjectHook as RequestProjectHook } from '@nuvix/core/resolvers/hooks';
import { DatabaseModule } from './database/database.module';
import { DatabaseController } from './database/database.controller';
import { PgMetaController, PgMetaModule } from '@nuvix/pg-meta';
import { UsersController } from './users/users.controller';
import { AccountController } from './account/account.controller';
import { OrganizationsController } from './organizations/organizations.controller';
import { ProjectController } from './projects/project.controller';
import { ProjectsController } from './projects/projects.controller';
import { AuditHook } from '@nuvix/core/resolvers/hooks/audit.hook';
import { AuditsQueue } from './resolvers/queues/audits.queue';
import { Key } from '@nuvix/core/helper/key.helper';

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
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
      prefix: 'nuvix',
    }),
    BullModule.registerQueue(
      { name: QueueFor.MAILS },
      { name: QueueFor.USAGE },
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
    CoreModule,
    UsersModule,
    AccountModule,
    OrganizationsModule,
    ProjectModule,
    DatabaseModule,
    PgMetaModule,
  ],
  controllers: [ConsoleController],
  providers: [ConsoleService, MailsQueue, AuditsQueue],
})
export class ConsoleModule implements NestModule, OnModuleInit {
  constructor(private readonly jwtService: JwtService) { }

  onModuleInit() {
    Key.setJwtService(this.jwtService);
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProjectHook)
      .forRoutes(
        UsersController,
        AccountController,
        OrganizationsController,
        ProjectController,
        ProjectsController,
        DatabaseController,
        PgMetaController,
      )
      .apply(RequestProjectHook)
      .forRoutes(DatabaseController, PgMetaController)
      .apply(HostHook)
      .forRoutes(
        UsersController,
        AccountController,
        OrganizationsController,
        ProjectController,
        ProjectsController,
        DatabaseController,
        PgMetaController,
      )
      .apply(AuthHook, ApiHook, AuditHook)
      .forRoutes(
        UsersController,
        AccountController,
        OrganizationsController,
        ProjectController,
        ProjectsController,
        DatabaseController,
        PgMetaController,
      );
  }
}
