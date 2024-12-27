import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { DirectiveLocation, GraphQLDirective } from 'graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from 'dotenv';
import { BaseModule } from './base/base.module';
import { DatabaseModule } from './database/database.module';
import { AccountModule } from './account/account.module';
import { ProjectModule } from './project/project.module';
import { RouterModule } from '@nestjs/core';
import path from 'path';

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
      type: 'mysql',
      logging: true,
      host: process.env.DB_HOST || 'localhost',
      port: 3306,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      entities: [],
      synchronize: false,
      timezone: 'Z',
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
    AccountModule,
    DatabaseModule,
    ProjectModule,
    RouterModule.register([
      {
        path: "v1",
        children: [
          {
            path: "console",
            children: [
              {
                path: "user",
                module: UserModule
              },
              {
                path: "account",
                module: AccountModule
              }
            ]
          },
          {
            path: "database",
            module: DatabaseModule
          },
          {
            path: "project",
            module: ProjectModule
          }
        ]
      }
    ])
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule { }