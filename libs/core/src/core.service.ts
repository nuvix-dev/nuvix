import { Injectable, Logger } from "@nestjs/common";
import type { ConfigService } from "./config.service.js";
import { Client } from 'pg';
import IORedis from 'ioredis';
import { Cache, Redis } from '@nuvix/cache';
import { Adapter, Database, Doc } from '@nuvix-tech/db';
import { Audit } from '@nuvix/audit';
import { Local } from '@nuvix/storage';
import { DataSource, Context } from '@nuvix/pg';
import { Reader, CountryResponse } from 'maxmind';
import { readFileSync } from 'fs';
import path from "path";
import type { ProjectsDoc } from "@nuvix/utils/types";
import { CORE_SCHEMA } from "@nuvix/utils";
import type { OAuthProviderType } from "./config/authProviders.js";

@Injectable()
export class CoreService {
    private readonly logger = new Logger(CoreService.name);
    private readonly cache: Cache;
    private readonly platformDb: Database;
    private readonly geoDb: Reader<CountryResponse>;
    constructor(private readonly configService: ConfigService) {
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

    createProjectDbClient(name: string | 'root',): Promise<Client>;
    createProjectDbClient(name: string, options: PoolOptions): Promise<Client>;
    async createProjectDbClient(name: string | 'root', options?: PoolOptions) {
        let databaseOptions: Partial<PoolOptions> & Record<string, any> = {};
        if (name === 'root') {
            databaseOptions = {
                ...this.configService.getDatabaseConfig().postgres,
            };
        } else if (options) {
            databaseOptions = {
                host: options.host,
                port: parseInt(options.port?.toString() || '5432'),
                database: options.database,
                user: options.user,
                password: options.password,
                ssl: true ? { rejectUnauthorized: false } : undefined,
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
    };

    async createCacheDb() {
        const redisConfig = this.configService.getRedisConfig();
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
        const redisConfig = this.configService.getRedisConfig();
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
        const platformDbConfig = this.configService.getDatabaseConfig().platform;
        const adapter = new Adapter({
            ...platformDbConfig,
            database: platformDbConfig.name,
        });
        const connection = new Database(adapter, this.cache).setMeta({
            schema: 'public',
            sharedTables: false,
            namespace: 'platform',
            database: adapter.$database,
        });
        return connection;
    }

    public getPlatformAudit() {
        return new Audit(this.platformDb);
    }

    public getPlatform(): Doc<Platform> {
        return new Doc() as Doc<Platform>;
    }

    getProjectDb(client: Client, projectId: string) {
        const adapter = new Adapter(client);
        adapter.setMeta({
            metadata: {
                'projectId': projectId
            }
        });
        const connection = new Database(adapter, this.cache);
        connection.setMeta({
            // cacheId: `${projectId}:core`
            schema: CORE_SCHEMA
        });
        return connection;
    };

    getProjectDevice(projectId: string) {
        const store = new Local(path.join(this.configService.get('storage')['uploads'], projectId));
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
                    this.configService.assetConfig.root,
                    'assets/dbip/dbip-country-lite-2024-09.mmdb',
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

    async createProjectDatabase(project: ProjectsDoc, options?: CreateProjectDatabaseOptions) {
        const dbOptions = project.get('database') as unknown as Record<string, any>;
        const client = await this.createProjectDbClient(project.getId(), {
            database: dbOptions["name"],
            user: dbOptions["adminRole"],
            password: dbOptions["adminPassword"] || this.configService.get('database')['postgres']['password'],
            port: dbOptions["port"],
            host: dbOptions["host"],
        });
        const dbForProject = this.getProjectDb(client, project.getId());
        dbForProject.setMeta({
            schema: options?.schema || CORE_SCHEMA,
            // cacheId: `${project.getId()}:core`,
        });
        return { client, dbForProject };
    }

    async releaseDatabaseClient(
        client?: Client,
    ) {
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
