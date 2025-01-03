import { Module } from '@nestjs/common';
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

let mongo_url_params = "?retryWrites=true&w=majority&appName=Buildo"

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      logging: true,
      host: process.env.DB_HOST || 'localhost',
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      // database: process.env.DB_NAME,
      autoLoadEntities: true,
      entities: [],
      ssl: true,
      synchronize: false,
      extra: {
        timezone: 'Z'
      }
    }),
    MongooseModule.forRoot(`${process.env.MONGO_URL}/server${mongo_url_params}`, {
      connectionName: 'server',
      onConnectionCreate: (connection) => {
        console.log(`MongoDB connected to "${connection.host}" database`);
      },
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      path: '/graphql',
      driver: ApolloDriver,
      autoSchemaFile: 'schema.gql',
      logger: customLogger,
      installSubscriptionHandlers: true,
      playground: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
      buildSchemaOptions: {
        directives: [
          new GraphQLDirective({
            name: 'upper',
            locations: [DirectiveLocation.FIELD_DEFINITION],
          }),
        ],
      },
    }),
    BaseModule,
    UserModule,
    ConsoleAccountModule,
    DatabaseModule,
    ProjectModule,
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
    ConsoleModule,
    AvatarsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule { }