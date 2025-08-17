import {
  Global,
  Inject,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as fs from 'fs';
import path from 'path';
import IORedis from 'ioredis';

import {
  DB_FOR_PLATFORM,
  GEO_DB,
  CACHE_DB,
  CACHE,
  GET_PROJECT_DB,
  GET_PROJECT_DB_CLIENT,
  GET_PROJECT_PG,
  PROJECT_ROOT,
  GET_DEVICE_FOR_PROJECT,
  APP_STORAGE_UPLOADS,
  AUDITS_FOR_PLATFORM,
  configuration,
} from '@nuvix/utils';
import { Adapter, Database, StructureValidator } from '@nuvix-tech/db';
import { Context, DataSource } from '@nuvix/pg';
import { CountryResponse, Reader } from 'maxmind';
import { Cache, Redis } from '@nuvix/cache';
import pg, { Client } from 'pg';
import { parse as parseArray } from 'postgres-array';
import { filters, formats } from '@nuvix/utils/database';
import { Device, Local } from '@nuvix/storage';
import { Audit } from '@nuvix/audit';
import { AppConfigService } from './config.service.js';
import { CoreService } from './core.service.js';
import { ConfigModule } from '@nestjs/config';

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

Object.entries(filters).forEach(([key, filter]) => {
  Database.addFilter(key, filter);
});

Object.entries(formats).forEach(([key, format]) => {
  StructureValidator.addFormat(key, format);
});

interface PoolOptions {
  database: string;
  user: string;
  password: string;
  host: string;
  port?: number;
}

export interface GetProjectDeviceFn {
  (projectId: string): Device;
}
/**@deprecated */
export type GetProjectDbFn = (pool: Client, projectId: string) => Database;
/**@deprecated */
export type GetProjectPGFn = (client: Client, context?: Context) => DataSource;
/**@deprecated */
export interface GetProjectDbClientFn {
  (name: string | 'root', options: PoolOptions): Promise<Client>;
}
/**@deprecated */
export interface GetProjectPGFnFn {
  (client: Client, options?: unknown): DataSource;
}

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
  providers: [
    {
      provide: AppConfigService,
      useClass: AppConfigService,
    },
    CoreService,
    {
      provide: GET_PROJECT_DB_CLIENT,
      useFactory: (config: AppConfigService): GetProjectDbClientFn => {
        return async (name: string | 'root', options: PoolOptions) => {
          let databaseOptions: Partial<PoolOptions> & Record<string, any> = {};
          if (name === 'root') {
            databaseOptions = {
              ...config.getDatabaseConfig().postgres,
            };
          } else {
            databaseOptions = {
              host: options.host,
              port: parseInt(options.port?.toString() || '5432'),
              database: options.database,
              user: options.user,
              password: options.password,
              // TODO: Check later
              ssl: true ? { rejectUnauthorized: false } : undefined,
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
      inject: [AppConfigService],
    },
    {
      provide: CACHE_DB,
      useFactory: async (config: AppConfigService) => {
        const redisConfig = config.getRedisConfig();
        const connection = new IORedis({
          connectionName: CACHE_DB.toString(),
          ...redisConfig,
          username: redisConfig.user,
          tls: redisConfig.secure ? { rejectUnauthorized: false } : undefined,
        });
        return connection;
      },
      inject: [AppConfigService],
    },
    {
      provide: CACHE,
      useFactory: async (config: AppConfigService, redis: IORedis) => {
        const redisConfig = config.getRedisConfig();
        const adpter = new Redis({
          ...redisConfig,
          username: redisConfig.user,
          tls: redisConfig.secure ? { rejectUnauthorized: false } : undefined,
          namespace: 'nuvix',
        });
        const cache = new Cache(adpter);
        return cache;
      },
      inject: [AppConfigService, CACHE_DB],
    },
    {
      provide: DB_FOR_PLATFORM,
      useFactory: async (config: AppConfigService, cache: Cache) => {
        const platformDbConfig = config.getDatabaseConfig().platform;
        const adapter = new Adapter({
          ...platformDbConfig,
          database: platformDbConfig.name,
        });
        const connection = new Database(adapter, cache).setMeta({
          schema: 'public',
          // cacheId: 'platform', // Uncomment after implementing cache
        });
        return connection;
      },
      inject: [AppConfigService, CACHE],
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
      useFactory: (cache: Cache): GetProjectDbFn => {
        return (client: Client, projectId: string) => {
          const adapter = new Adapter(client);
          adapter.setMeta({
            metadata: {
              projectId: projectId,
            },
          });
          const connection = new Database(adapter, cache);
          connection.setMeta({
            // cacheId: `${projectId}:core`
          });
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
      useFactory: (): GetProjectPGFn => {
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
  ],
  exports: [
    AppConfigService,
    CoreService,
    GET_PROJECT_DB_CLIENT,
    DB_FOR_PLATFORM,
    AUDITS_FOR_PLATFORM,
    GET_DEVICE_FOR_PROJECT,
    GET_PROJECT_DB,
    GET_PROJECT_PG,
    GEO_DB,
    CACHE_DB,
    CACHE,
  ],
})
export class CoreModule implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(CoreModule.name);
  constructor(@Inject(CACHE) private readonly cache: Cache) {}

  async onModuleInit() {
    await this.cache.flush();
  }

  async onModuleDestroy() {
    this.logger.log('Initiating cache flush during module shutdown...');
    await this.cache.flush();
    this.logger.log('Cache successfully flushed on module shutdown.');
  }
}
