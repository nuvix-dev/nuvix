import { Global, Logger, Module, Scope } from '@nestjs/common';
import * as fs from 'fs';
import path from 'path';
import IORedis from 'ioredis';

// Services
import { ClsService } from 'nestjs-cls';
import {
  DB_FOR_CONSOLE,
  DB_FOR_PROJECT,
  GEO_DB,
  CACHE_DB,
  APP_REDIS_PATH,
  APP_REDIS_PORT,
  APP_REDIS_HOST,
  APP_REDIS_USER,
  APP_REDIS_PASSWORD,
  APP_REDIS_DB,
  APP_REDIS_SECURE,
} from 'src/Utils/constants';
import { Database, MariaDB, Structure } from '@nuvix/database';
import { filters, formats } from './resolvers/db.resolver';
import { CountryResponse, Reader } from 'maxmind';

Object.keys(filters).forEach((key) => {
  Database.addFilter(key, {
    encode: filters[key].serialize,
    decode: filters[key].deserialize,
  });
});

Object.keys(formats).forEach((key) => {
  Structure.addFormat(key, formats[key].create, formats[key].type);
});

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

        const connection = new Database(adapter);

        await connection.ping();

        return connection;
      },
      inject: [ClsService],
    },
    {
      provide: DB_FOR_PROJECT,
      // scope: Scope.REQUEST,
      useFactory: async (cls: ClsService) => {
        const adapter = new MariaDB({
          connection: {
            host: process.env.DATABASE_HOST || 'localhost',
            user: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME2,
            port: 3306,
          },
          maxVarCharLimit: 5000,
        });

        await adapter.init();

        const connection = new Database(adapter);

        connection.setSharedTables(true);

        await connection.ping();

        return connection;
      },
      inject: [ClsService],
    },
    {
      provide: GEO_DB,
      useFactory: async (cls: ClsService) => {
        const logger = cls.get<Logger>('logger');
        try {
          const buffer = fs.readFileSync(
            path.resolve(
              __dirname,
              '../../assets/dbip/dbip-country-lite-2024-09.mmdb',
            ),
          );
          return new Reader<CountryResponse>(buffer);
        } catch (error) {
          logger.warn(
            'GeoIP database not found, country detection will be disabled',
          );
          return {};
        }
      },
      inject: [ClsService],
    },
    {
      provide: CACHE_DB,
      useFactory: async () => {
        const connection = new IORedis({
          connectionName: CACHE_DB,
          path: APP_REDIS_PATH,
          port: APP_REDIS_PORT,
          host: APP_REDIS_HOST,
          username: APP_REDIS_USER,
          password: APP_REDIS_PASSWORD,
          db: APP_REDIS_DB,
          tls: APP_REDIS_SECURE ? {} : undefined,
        });
        return connection;
      },
      inject: [],
    },
  ],
  exports: [DB_FOR_CONSOLE, DB_FOR_PROJECT, GEO_DB, CACHE_DB],
})
export class CoreModule {}
