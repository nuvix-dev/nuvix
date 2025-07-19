import { Global, Logger, Module } from '@nestjs/common';
import * as fs from 'fs';
import path from 'path';
import IORedis from 'ioredis';

// Services
import {
  DB_FOR_PLATFORM,
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
  GET_PROJECT_DB_CLIENT,
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
  GET_DEVICE_FOR_PROJECT,
  APP_STORAGE_UPLOADS,
  AUDITS_FOR_PLATFORM,
} from '@nuvix/utils/constants';
import { Database, MariaDB, Structure, PostgreDB } from '@nuvix/database';
import { Context, DataSource } from '@nuvix/pg';
import { CountryResponse, Reader } from 'maxmind';
import { Cache, Redis } from '@nuvix/cache';
import { ProjectUsageService } from './project-usage.service';
import pg, { Client } from 'pg';
import { parse as parseArray } from 'postgres-array';
import { filters, formats } from '@nuvix/utils/database';
import { Device, Local } from '@nuvix/storage';
import { Audit } from '@nuvix/audit';

export function configurePgTypeParsers() {
  const types = pg.types;

  types.setTypeParser(types.builtins.INT8, x => {
    const asNumber = Number(x);
    return Number.isSafeInteger(asNumber) ? asNumber : x;
  });

  types.setTypeParser(types.builtins.NUMERIC, parseFloat);
  types.setTypeParser(types.builtins.FLOAT4, parseFloat);
  types.setTypeParser(types.builtins.FLOAT8, parseFloat);
  types.setTypeParser(types.builtins.BOOL, val => val === 't');

  types.setTypeParser(types.builtins.DATE, x => x);
  types.setTypeParser(types.builtins.TIMESTAMP, x => x);
  types.setTypeParser(types.builtins.TIMESTAMPTZ, x => x);
  types.setTypeParser(types.builtins.INTERVAL, x => x);

  types.setTypeParser(1115 as any, parseArray); // _timestamp[]
  types.setTypeParser(1182 as any, parseArray); // _date[]
  types.setTypeParser(1185 as any, parseArray); // _timestamptz[]
  types.setTypeParser(600 as any, x => x); // point
  types.setTypeParser(1017 as any, x => x); // _point
}

configurePgTypeParsers();

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
  /**@deprecated No longer used */
  max?: number;
}
export interface GetClientFn {
  (name: string, options: PoolOptions): Promise<Client>;
  (name: 'root', options?: Partial<PoolOptions>): Promise<Client>;
}

export interface GetProjectDeviceFn {
  (projectId: string): Device;
}

export type GetProjectDbFn = (pool: Client, projectId: string) => Database;

export type GetProjectPG = (client: Client, context?: Context) => DataSource;

@Global()
@Module({
  providers: [
    {
      provide: GET_PROJECT_DB_CLIENT,
      useFactory: (): GetClientFn => {
        return async (name: string | 'root', options: PoolOptions) => {
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

          const client = new Client({
            ...databaseOptions,
            statement_timeout: 30000, // 30 seconds
            query_timeout: 30000, // 30 seconds
            application_name: name === 'root' ? 'nuvix' : `nuvix-${name}`,
            keepAliveInitialDelayMillis: 10000, // 10 seconds
          });
          await client.connect();

          client.on('error', err => {
            const logger = new Logger('PoolManager');
            logger.error(`Client error for ${name}:`, err);
          });

          return client;
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
      provide: AUDITS_FOR_PLATFORM,
      useFactory: async (database: Database) => {
        return new Audit(database);
      },
      inject: [DB_FOR_PLATFORM],
    },
    {
      provide: GET_PROJECT_DB,
      useFactory: (cache: Cache) => {
        return (client: Client, projectId: string) => {
          const adapter = new PostgreDB({
            connection: client as any, // #<PoolClient> until lib update
          });
          adapter.init();
          adapter.setMetadata('projectId', projectId);
          const connection = new Database(adapter, cache, {
            logger: LOG_LEVELS,
          }).setCacheName(projectId); // TODO: will use any other constraint instead of `projectId`
          return connection;
        };
      },
      inject: [CACHE],
    },
    {
      provide: GET_DEVICE_FOR_PROJECT,
      useFactory: () => {
        return (projectId: string) => {
          const store = new Local(path.join(APP_STORAGE_UPLOADS, projectId));
          return store;
        };
      },
    },
    {
      provide: GET_PROJECT_PG,
      useFactory: () => {
        return (client: Client, ctx?: Context) => {
          ctx = ctx ?? new Context();
          const connection = new DataSource(
            client as any, // #<PoolClient> until lib update
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
    GET_PROJECT_DB_CLIENT,
    DB_FOR_PLATFORM,
    AUDITS_FOR_PLATFORM,
    GET_DEVICE_FOR_PROJECT,
    GET_PROJECT_DB,
    GET_PROJECT_PG,
    GEO_DB,
    CACHE_DB,
    CACHE,
    ProjectUsageService,
  ],
})
export class CoreModule {}
