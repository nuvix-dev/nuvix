import {
  Logger,
  MiddlewareConsumer,
  Module,
  OnModuleInit,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { DirectiveLocation, GraphQLDirective } from 'graphql';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { config } from 'dotenv';
import { BaseModule } from './base/base.module';
import { DatabaseModule } from './database/database.module';
import { ProjectModule } from './projects/project.module';
import { ConsoleModule } from './console/console.module';
import { AvatarsModule } from './avatars/avatars.module';
import { UsersModule } from './users/users.module';
import { AccountModule } from './account/account.module';
import { TeamsModule } from './teams/teams.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ClsModule, ClsService } from 'nestjs-cls';
import { Request } from 'express';
import { FunctionsModule } from './functions/functions.module';
import { AuthMiddleware } from './core/resolver/middlewares/auth.middleware';
import { DB_FOR_CONSOLE } from './Utils/constants';
import { DbModule } from './core/db.provider';
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
    // GraphQLModule.forRoot<ApolloDriverConfig>({
    //   path: '/graphql',
    //   driver: ApolloDriver,
    //   autoSchemaFile: 'schema.gql',
    //   logger: customLogger,
    //   installSubscriptionHandlers: true,
    //   playground: false,
    //   plugins: [ApolloServerPluginLandingPageLocalDefault()],
    //   buildSchemaOptions: {
    //     directives: [
    //       new GraphQLDirective({
    //         name: 'upper',
    //         locations: [DirectiveLocation.FIELD_DEFINITION],
    //       }),
    //     ],
    //   },
    // }),
    DbModule,
    BaseModule,
    ConsoleModule,
    ProjectModule,
    // UsersModule,
    // TeamsModule,
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
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
