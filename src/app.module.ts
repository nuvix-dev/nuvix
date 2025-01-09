import { Module, OnModuleInit } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { DirectiveLocation, GraphQLDirective } from 'graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './console-user/user.module';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from 'dotenv';
import { BaseModule } from './base/base.module';
import { DatabaseModule } from './database/database.module';
import { ConsoleAccountModule } from './console-account/account.module';
import { ProjectModule } from './project/project.module';
import { RouterModule } from '@nestjs/core';
import { ConsoleModule } from './console/console.module';
import { AvatarsModule } from './avatars/avatars.module';
import { UsersModule } from './users/users.module';
import { AccountModule } from './account/account.module';
import { TeamsModule } from './teams/teams.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ClsModule, ClsService, ClsServiceManager } from 'nestjs-cls';
import { Authorization } from './core/validators/authorization.validator';

config();


class CustomLogger {
  debug(message?: any): void {
    console.debug(message);
  }
  info(message?: any): void {
    console.info(message);
  }
  warn(message?: any): void {
    console.warn(message);
  }
  error(message?: any): void {
    console.error(message);
  }
}

const customLogger = new CustomLogger();

let mongo_url_params = "?retryWrites=true&w=majority&appName=Nuvix"

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup(cls, req, res) {
          cls.set('req', req);
          cls.set('res', res);
          cls.set('authorization', new Authorization());
        },
      },
    }),
    MongooseModule.forRoot(`${process.env.MONGO_URL}/server${mongo_url_params}`, {
      connectionName: 'server',
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
    BaseModule,
    UserModule,
    ConsoleAccountModule,
    DatabaseModule,
    ProjectModule,
    ConsoleModule,
    AvatarsModule,
    UsersModule,
    AccountModule,
    TeamsModule,
    RealtimeModule,
    RouterModule.register([
      {
        path: "v1",
        module: BaseModule,
        children: [
          {
            path: "console",
            module: ConsoleModule,
            children: [
              {
                path: "users",
                module: UserModule
              },
              {
                path: "account",
                module: ConsoleAccountModule
              }
            ]
          },
          {
            path: "account",
            module: AccountModule
          },
          {
            path: "teams",
            module: TeamsModule
          },
          {
            path: "users",
            module: UsersModule
          },
          {
            path: "databases",
            module: DatabaseModule
          },
          {
            path: "projects",
            module: ProjectModule
          },
          {
            path: 'avatars',
            module: AvatarsModule
          }
        ]
      }
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule { } 