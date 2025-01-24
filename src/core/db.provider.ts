import {
  FactoryProvider,
  Global,
  Injectable,
  Logger,
  Module,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Exception } from './extend/exception';
import { Request } from 'express';

// Services
import { ClsService, ClsServiceManager } from 'nestjs-cls';
import { DB_FOR_CONSOLE, PROJECT } from 'src/Utils/constants';
import {
  Authorization,
  Database,
  DuplicateException,
  MariaDB,
  Role,
} from '@nuvix/database';
import { filters } from './resolver/db.resolver';

@Global()
@Module({
  providers: [
    {
      provide: DB_FOR_CONSOLE,
      useFactory: async (cls: ClsService) => {
        const adapter = new MariaDB({
          connection: {
            host: process.env.DATABASE_HOST || 'localhost',
            user: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME,
            port: 3306,
          },
          maxVarCharLimit: 5000,
        });

        await adapter.init();

        Authorization.setRole(Role.user('john-doe').toString());

        Object.keys(filters).forEach((key) => {
          Database.addFilter(key, {
            encode: filters[key].serialize,
            decode: filters[key].deserialize,
          });
        });

        const connection = new Database(adapter);

        try {
          await connection.create('test1');
        } catch (e) {
          if (e instanceof DuplicateException) {
          } else throw e;
        }

        await connection.ping();

        return connection;
      },
      inject: [ClsService],
    },
  ],
  exports: [DB_FOR_CONSOLE],
})
export class DbModule {}
