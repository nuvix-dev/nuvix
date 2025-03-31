import { Global, Logger, Module, Scope } from '@nestjs/common';
import * as fs from 'fs';
import path from 'path';
import IORedis from 'ioredis';

// Services
import {
  DB_FOR_CONSOLE,
  DB_FOR_PROJECT,
  GEO_DB,
  CACHE_DB,
  CACHE,
  APP_REDIS_PATH,
  APP_REDIS_PORT,
  APP_REDIS_HOST,
  APP_REDIS_USER,
  APP_REDIS_PASSWORD,
  APP_REDIS_DB,
  APP_REDIS_SECURE,
  GET_PROJECT_DB,
  POOLS,
} from 'src/Utils/constants';
import {
  Database,
  MariaDB,
  Structure,
  PoolManager,
  PostgreDB,
  PoolOptions,
} from '@nuvix/database';
import { filters, formats } from './resolvers/db.resolver';
import { CountryResponse, Reader } from 'maxmind';
import { Cache, Redis } from '@nuvix/cache';
import { Telemetry } from '@nuvix/telemetry';
import { ProjectUsageService } from './project-usage.service';
import { Adapter } from '@nuvix/database/dist/adapter/base';
import { Pool } from 'pg';

Object.keys(filters).forEach(key => {
  Database.addFilter(key, {
    encode: filters[key].serialize,
    decode: filters[key].deserialize,
  });
});

Object.keys(formats).forEach(key => {
  Structure.addFormat(key, formats[key].create, formats[key].type);
});

@Global()
@Module({
  providers: [
    {
      provide: POOLS,
      useFactory: async () => {
        const poolManager = PoolManager.getInstance();
        return async (
          name: string,
          options: PoolOptions & { database: string },
        ) => {
          const pool = await poolManager.getPool(
            name,
            (async _options => {
              return new Pool({
                host: process.env.APP_POSTGRES_HOST || 'localhost',
                port: parseInt(process.env.APP_POSTGRES_PORT || '5432'),
                database: options.database,
                user: process.env.APP_POSTGRES_USER,
                password: process.env.APP_POSTGRES_PASSWORD,
                ssl:
                  process.env.APP_POSTGRES_SSL === 'true'
                    ? { rejectUnauthorized: false }
                    : undefined,
              });
            }) as any,
            options,
          );
          return pool;
        };
      },
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
    {
      provide: CACHE,
      useFactory: async (redis: IORedis) => {
        const adpter = new Redis(redis);
        const cache = new Cache(adpter);
        await cache.ping();
        return cache;
      },
      inject: [CACHE_DB],
    },
    {
      provide: DB_FOR_CONSOLE,
      useFactory: async (cache: Cache) => {
        const adapter = new MariaDB({
          connection: {
            host: process.env.APP_DB_HOST || 'localhost',
            user: process.env.APP_DB_USER,
            password: process.env.APP_DB_PASSWORD,
            database: process.env.APP_DB_NAME,
            port: 3306,
          },
          maxVarCharLimit: 5000,
        });

        adapter.init();
        const connection = new Database(adapter, cache);
        return connection;
      },
      inject: [CACHE],
    },
    {
      // TODO: This is a temporary solution, we need to find a better way to handle this (request scope or hook)
      provide: DB_FOR_PROJECT,
      // scope: Scope.REQUEST,
      useFactory: async (cache: Cache, _pools: Map<string, Adapter>) => {
        // const adapter = new MariaDB({
        //   connection: {
        //     host: process.env.DATABASE_HOST || 'localhost',
        //     user: process.env.DATABASE_USER,
        //     password: process.env.DATABASE_PASSWORD,
        //     database: process.env.DATABASE_NAME2,
        //     port: 3306,
        //   },
        //   maxVarCharLimit: 5000,
        // });
        // adapter.init();
        // const connection = new Database(adapter, cache);
        // connection.setSharedTables(true);
        // await connection.ping();
        // return connection;
      },
      inject: [CACHE, POOLS],
    },
    {
      provide: GET_PROJECT_DB,
      // scope: Scope.REQUEST,
      useFactory: async (cache: Cache) => {
        return async (projectId: string) => {
          // const adapter = new MariaDB({
          //   connection: {
          //     host: process.env.DATABASE_HOST || 'localhost',
          //     user: process.env.DATABASE_USER,
          //     password: process.env.DATABASE_PASSWORD,
          //     database: process.env.DATABASE_NAME2,
          //     port: 3306,
          //   },
          //   maxVarCharLimit: 5000,
          // });
          // await adapter.init();
          // const connection = new Database(adapter, cache);
          // connection.setSharedTables(true);
          // connection.setPrefix(`_${projectId}`);
          // connection.setTenant(Number(projectId));
          // return connection;
        };
      },
      inject: [CACHE],
    },
    {
      provide: GEO_DB,
      useFactory: async () => {
        const logger = new Logger('GeoIP');
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
          return {}; // TODO: return a dummy reader
        }
      },
    },
    ProjectUsageService,
  ],
  exports: [
    DB_FOR_CONSOLE,
    DB_FOR_PROJECT,
    GET_PROJECT_DB,
    GEO_DB,
    CACHE_DB,
    CACHE,
    ProjectUsageService,
  ],
})
export class CoreModule {}
