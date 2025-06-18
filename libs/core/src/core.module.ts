import { Global, Logger, Module } from '@nestjs/common';
import * as fs from 'fs';
import path from 'path';
import IORedis from 'ioredis';

// Services
import {
  DB_FOR_PLATFORM,
  DB_FOR_PROJECT,
  GEO_DB,
  CACHE_DB,
  CACHE,
  APP_REDIS_PORT,
  APP_REDIS_HOST,
  APP_REDIS_USER,
  APP_REDIS_PASSWORD,
  APP_REDIS_DB,
  APP_REDIS_SECURE,
  GET_PROJECT_DB,
  POOLS,
  GET_PROJECT_PG,
  PROJECT_ROOT,
  LOG_LEVELS,
  APP_DATABASE_HOST,
  APP_DATABASE_USER,
  APP_DATABASE_PASSWORD,
  APP_DATABASE_NAME,
  APP_DATABASE_PORT,
  APP_POSTGRES_HOST,
  APP_POSTGRES_PORT,
  APP_POSTGRES_DB,
  APP_POSTGRES_USER,
  APP_POSTGRES_PASSWORD,
  APP_POSTGRES_SSL,
} from '@nuvix/utils/constants';
import { Database, MariaDB, Structure, PostgreDB } from '@nuvix/database';
import { Context, DataSource } from '@nuvix/pg';
import { CountryResponse, Reader } from 'maxmind';
import { Cache, Redis } from '@nuvix/cache';
import { ProjectUsageService } from './project-usage.service';
import { Adapter } from '@nuvix/database';
import { Pool as PgPool, PoolClient } from 'pg';
import { createHash } from 'crypto';
import { filters, formats } from '@nuvix/utils/database';

Object.keys(filters).forEach(key => {
  Database.addFilter(key, {
    encode: filters[key].serialize,
    decode: filters[key].deserialize,
  });
});

Object.keys(formats).forEach(key => {
  Structure.addFormat(key, formats[key].create, formats[key].type);
});

interface PoolOptions {
  database: string;
  user: string;
  password: string;
  host: string;
  port?: number;
  max?: number;
}
export interface PoolStoreFn {
  (name: string, options: PoolOptions): Promise<PgPool>;
  (name: 'root', options?: Partial<PoolOptions>): Promise<PgPool>;
}

export type GetProjectDbFn = (pool: PoolClient, projectId: string) => Database;

export type GetProjectPG = (
  client: PoolClient,
  context?: Context,
) => DataSource;

@Global()
@Module({
  providers: [
    {
      provide: POOLS,
      useFactory: (): PoolStoreFn => {
        const poolCache: Map<string, PgPool> = new Map();

        return async (name: string | 'root', options: PoolOptions) => {
          const cacheHash = createHash('sha256');
          cacheHash.update(JSON.stringify(options));
          const hash = cacheHash.digest('hex');
          const cacheKey = `${name}-${hash}`;

          if (poolCache.has(cacheKey)) {
            const existingPool = poolCache.get(cacheKey);
            // Check if the pool is still valid and connected
            if (existingPool && !existingPool.ended) {
              return existingPool;
            }
          }

          let databaseOptions = {};
          if (name === 'root') {
            databaseOptions = {
              host: APP_POSTGRES_HOST,
              port: APP_POSTGRES_PORT,
              database: APP_POSTGRES_DB,
              user: APP_POSTGRES_USER,
              password: APP_POSTGRES_PASSWORD,
              ssl: APP_POSTGRES_SSL ? { rejectUnauthorized: false } : undefined,
            };
          } else {
            databaseOptions = {
              host: options.host,
              port: parseInt(options.port.toString() || '5432'),
              database: options.database,
              user: options.user,
              password: options.password,
              // TODO: Check later
              ssl: APP_POSTGRES_SSL ? { rejectUnauthorized: false } : undefined,
            };
          }

          const newPool = new PgPool({
            ...databaseOptions,
            max: options.max ?? 10,
            idleTimeoutMillis: 30000, // 30 seconds
            statement_timeout: 30000, // 30 seconds
            query_timeout: 30000, // 30 seconds
            application_name: name === 'root' ? 'nuvix' : `nuvix-${name}`,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000, // 10 seconds
            allowExitOnIdle: false,
          });

          poolCache.set(cacheKey, newPool);

          newPool.on('error', err => {
            const logger = new Logger('PoolManager');
            logger.error(`Pool error for ${cacheKey}:`, err);
            if (err.name === 'ECONNREFUSED') {
              poolCache.delete(cacheKey);
            }
          });

          return newPool;
        };
      },
    },
    {
      provide: CACHE_DB,
      useFactory: async () => {
        const connection = new IORedis({
          connectionName: CACHE_DB.toString(),
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
        const adpter = new Redis({
          port: APP_REDIS_PORT,
          host: APP_REDIS_HOST,
          username: APP_REDIS_USER,
          password: APP_REDIS_PASSWORD,
          db: APP_REDIS_DB,
          tls: APP_REDIS_SECURE,
          namespace: 'nuvix',
        } as any);
        const cache = new Cache(adpter);
        return cache;
      },
      inject: [CACHE_DB],
    },
    {
      provide: DB_FOR_PLATFORM,
      useFactory: async (cache: Cache) => {
        const adapter = new MariaDB({
          connection: {
            host: APP_DATABASE_HOST,
            user: APP_DATABASE_USER,
            password: APP_DATABASE_PASSWORD,
            database: APP_DATABASE_NAME,
            port: APP_DATABASE_PORT,
          },
          maxVarCharLimit: 5000,
        });

        adapter.init();
        const connection = new Database(adapter, cache, {
          logger: LOG_LEVELS,
        });
        return connection;
      },
      inject: [CACHE],
    },
    {
      // TODO: This is a temporary solution, we need to find a better way to handle this (request scope or hook)
      provide: DB_FOR_PROJECT,
      // scope: Scope.REQUEST,
      /**@deprecated */
      useFactory: async (cache: Cache, _pools: Map<string, Adapter>) => {
        // const adapter = new MariaDB({
        //   connection: {
        //     host: APP_DATABASE_HOST,
        //     user: APP_DATABASE_USER,
        //     password: APP_DATABASE_PASSWORD,
        //     database: APP_DATABASE_NAME,
        //     port: APP_DATABASE_PORT,
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
      useFactory: (cache: Cache) => {
        return (pool: PoolClient, projectId: string) => {
          const adapter = new PostgreDB({
            connection: pool,
          });
          adapter.init();
          adapter.setMetadata('projectId', projectId);
          const connection = new Database(adapter, cache, {
            logger: LOG_LEVELS,
          });
          return connection;
        };
      },
      inject: [CACHE],
    },
    {
      provide: GET_PROJECT_PG,
      useFactory: () => {
        return (client: PoolClient, ctx?: Context) => {
          ctx = ctx ?? new Context();
          const connection = new DataSource(
            client,
            {},
            { context: ctx, listenForUpdates: true },
          );
          return connection;
        };
      },
    },
    {
      provide: GEO_DB,
      useFactory: async () => {
        const logger = new Logger('GeoIP');
        try {
          const buffer = fs.readFileSync(
            path.resolve(
              PROJECT_ROOT,
              'assets/dbip/dbip-country-lite-2024-09.mmdb',
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
    POOLS,
    DB_FOR_PLATFORM,
    DB_FOR_PROJECT,
    GET_PROJECT_DB,
    GET_PROJECT_PG,
    GEO_DB,
    CACHE_DB,
    CACHE,
    ProjectUsageService,
  ],
})
export class CoreModule {}
