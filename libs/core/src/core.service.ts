import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from './config.service.js';
import { Client } from 'pg';
import IORedis from 'ioredis';
import { Cache, Redis } from '@nuvix/cache';
import { Adapter, Database, Doc } from '@nuvix-tech/db';
import { Audit } from '@nuvix/audit';
import { Local } from '@nuvix/storage';
import { DataSource, Context } from '@nuvix/pg';
import { Reader, CountryResponse } from 'maxmind';
import { readFileSync } from 'fs';
import path from 'path';
import type { ProjectsDoc } from '@nuvix/utils/types';
import {
  DatabaseConfig,
  DatabaseRole,
  DEFAULT_DATABASE,
  Schemas,
} from '@nuvix/utils';
import type { OAuthProviderType } from './config/authProviders.js';

@Injectable()
export class CoreService {
  private readonly logger = new Logger(CoreService.name);
  private readonly cache: Cache;
  private readonly platformDb: Database;
  private readonly geoDb: Reader<CountryResponse>;
  constructor(private readonly appConfig: AppConfigService) {
    this.cache = this.createCache();
    this.platformDb = this.createPlatformDb();
    this.geoDb = this.createGeoDb();
  }

  public getCache(): Cache {
    return this.cache;
  }

  public getPlatformDb(): Database {
    return this.platformDb;
  }

  public getGeoDb(): Reader<CountryResponse> {
    return this.geoDb;
  }

  createProjectDbClient(name: string | 'root'): Promise<Client>;
  createProjectDbClient(name: string, options: PoolOptions): Promise<Client>;
  async createProjectDbClient(name: string | 'root', options?: PoolOptions) {
    let databaseOptions: Partial<PoolOptions> & Record<string, any> = {};
    if (name === 'root') {
      databaseOptions = {
        ...this.appConfig.getDatabaseConfig().postgres,
      };
    } else if (options) {
      databaseOptions = {
        host: options.host,
        port: parseInt(options.port?.toString() || '5432'),
        database: options.database,
        user: options.user,
        password: options.password,
        ssl: false ? { rejectUnauthorized: false } : undefined,
      };
    }

    const client = new Client({
      ...databaseOptions,
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: name === 'root' ? 'nuvix' : `nuvix-${name}`,
      keepAliveInitialDelayMillis: 10000,
    });
    await client.connect();

    client.on('error', err => {
      this.logger.error(`Client error for ${name}:`, err);
    });

    return client;
  }

  createCacheDb() {
    const redisConfig = this.appConfig.getRedisConfig();
    const connection = new IORedis({
      connectionName: 'CACHE_DB',
      ...redisConfig,
      username: redisConfig.user,
      tls: redisConfig.secure ? { rejectUnauthorized: false } : undefined,
    });
    return connection;
  }

  createCache(redis?: IORedis) {
    if (this.cache) {
      return this.cache;
    }
    const redisConfig = this.appConfig.getRedisConfig();
    const adapter = new Redis({
      ...redisConfig,
      username: redisConfig.user,
      tls: redisConfig.secure ? { rejectUnauthorized: false } : undefined,
      namespace: 'nuvix',
    });
    const cache = new Cache(adapter);
    return cache;
  }

  private createPlatformDb() {
    if (this.platformDb) {
      return this.platformDb;
    }
    const platformDbConfig = this.appConfig.getDatabaseConfig().platform;
    const adapter = new Adapter({
      ...platformDbConfig,
      database: platformDbConfig.name,
      max: 100,
    });
    const connection = new Database(adapter, this.cache).setMeta({
      schema: 'public',
      sharedTables: false,
      namespace: 'platform',
    });
    return connection;
  }

  public getPlatformAudit() {
    return new Audit(this.platformDb);
  }

  public getPlatform(): Doc<Platform> {
    const data: Platform = {
      auths: {
        limit: 1,
        personalDataCheck: true,
        passwordHistory: 10,
        duration: undefined,
        sessionAlerts: true,
      },
      oAuthProviders: [],
    };

    return new Doc(data);
  }

  getProjectDb(client: Client, { projectId, ...options }: GetProjectDBOptions) {
    const adapter = new Adapter(client);
    adapter.setMeta({
      metadata: {
        projectId: projectId,
      },
    });
    const connection = new Database(adapter, this.cache);
    connection.setMeta({
      // cacheId: `${projectId}:core`
      schema: options.schema ?? Schemas.Core,
      namespace: 'nx',
      metadata: { project: projectId },
    });
    connection.setAttachSchemaInDocument(true);
    return connection;
  }

  getProjectDevice(projectId: string) {
    const store = new Local(
      path.join(this.appConfig.get('storage')['uploads'], projectId),
    );
    return store;
  }

  getProjectPg(client: Client, ctx?: Context) {
    ctx = ctx ?? new Context();
    const connection = new DataSource(
      client as any,
      {},
      { context: ctx, listenForUpdates: true },
    );
    return connection;
  }

  createGeoDb(): Reader<CountryResponse> {
    try {
      const buffer = readFileSync(
        path.resolve(
          this.appConfig.assetConfig.root,
          'dbip/dbip-country-lite-2024-09.mmdb',
        ),
      );
      return new Reader<CountryResponse>(buffer);
    } catch (error) {
      this.logger.warn(
        'GeoIP database not found, country detection will be disabled',
      );
      return {} as any; // TODO: return a mock or empty reader
    }
  }

  async createProjectDatabase(
    project: ProjectsDoc,
    options?: CreateProjectDatabaseOptions,
  ) {
    const dbOptions = project.get('database') as unknown as DatabaseConfig;
    const client = await this.createProjectDbClient(project.getId(), {
      database: DEFAULT_DATABASE,
      user: DatabaseRole.ADMIN,
      password: dbOptions?.pool?.password,
      port: dbOptions?.pool?.port,
      host: dbOptions?.pool?.host,
    });
    const dbForProject = this.getProjectDb(client, {
      projectId: project.getId(),
      schema: options?.schema,
    });
    return { client, dbForProject };
  }

  async releaseDatabaseClient(client?: Client) {
    try {
      if (client) {
        await client.end();
      }
    } catch (error) {
      this.logger.error('Failed to release database client', error);
    }
  }
}

interface PoolOptions {
  database: string;
  user: string;
  password: string;
  host: string;
  port?: number;
}

interface GetProjectDBOptions {
  projectId: string;
  schema?: string;
}

interface CreateProjectDatabaseOptions {
  schema?: string;
}

export interface Platform {
  authWhitelistEmails?: string[];
  authWhitelistIPs?: string[];
  auths: {
    limit?: number;
    personalDataCheck?: boolean;
    passwordHistory?: number;
    duration?: number;
    sessionAlerts?: boolean;
  };
  oAuthProviders: OAuthProviderType[];
}
