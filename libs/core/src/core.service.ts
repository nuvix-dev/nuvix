import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { Audit } from '@nuvix/audit'
import { Cache, Redis } from '@nuvix/cache'
import { Adapter, Database, Logger as DbLogger, Doc } from '@nuvix/db'
import { Context, DataSource } from '@nuvix/pg'
import { Local } from '@nuvix/storage'
import { DatabaseRole, DEFAULT_DATABASE, Schemas } from '@nuvix/utils'
import type { ProjectsDoc } from '@nuvix/utils/types'
import IORedis from 'ioredis'
import { CountryResponse, Reader } from 'maxmind'
import { Client, Pool, PoolClient } from 'pg'
import type { OAuthProviderType } from './config/authProviders.js'
import { AppConfigService } from './config.service.js'
import { Exception } from './extend/exception.js'

@Injectable()
export class CoreService implements OnModuleDestroy {
  private readonly logger = new Logger(CoreService.name)
  private cache: Cache | null = null
  private geoDb: Reader<CountryResponse> | null = null
  private redisInstance: IORedis | null = null
  private readonly projectPool: Pool | null = null
  private postgresPool: Pool | null = null

  constructor(private readonly appConfig: AppConfigService) {
    this.geoDb = this.createGeoDb()
    this.redisInstance = this.createRedisInstance()
    this.cache = this.createCache()
    this.projectPool = this.createMainPool()
  }

  dbLogger(): DbLogger {
    return new DbLogger({
      level: 'error',
      enabled: this.appConfig.get('logLevels').length > 0,
    })
  }

  async onModuleDestroy() {
    if (this.projectPool) {
      try {
        await this.projectPool.end()
      } catch (error) {
        this.logger.error('Failed to disconnect project database pool', error)
      }
    }
    if (this.redisInstance) {
      try {
        await this.redisInstance.quit()
      } catch (error) {
        this.logger.error('Failed to disconnect redis instance', error)
      }
    }
  }

  public getCache(): Cache {
    if (!this.cache) {
      throw new Exception('Cache not initialized')
    }
    return this.cache
  }

  public getPlatformDb(): Database {
    if (!this.projectPool) {
      throw new Exception('Project DB not initialized')
    }
    const adapter = new Adapter(this.projectPool)
      .setMeta({
        schema: Schemas.Internal,
        sharedTables: false,
        namespace: 'platform',
      })
      .setLogger(this.dbLogger())

    return new Database(adapter, this.getCache())
  }

  public getGeoDb(): Reader<CountryResponse> {
    if (!this.geoDb) {
      throw new Exception('Geo DB not initialized')
    }
    return this.geoDb
  }

  public createMainPool(): Pool {
    if (this.projectPool) {
      return this.projectPool
    }
    const options = this.appConfig.getDatabaseConfig()

    const pool = new Pool({
      database: DEFAULT_DATABASE,
      user: DatabaseRole.ADMIN,
      password: options.postgres.adminPassword,
      host: options.useExternalPool
        ? options.postgres.pool.host!
        : options.postgres.host,
      port: options.useExternalPool
        ? options.postgres.pool.port
        : options.postgres.port,
      ssl: this.appConfig.getDatabaseConfig().postgres.ssl
        ? { rejectUnauthorized: false }
        : undefined,
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: 'nuvix-main',
      keepAliveInitialDelayMillis: 10000,
      max: options.postgres.maxConnections,
      idleTimeoutMillis: 5000,
    })

    pool.on('error', err => {
      this.logger.error('Main pool error:', err)
    })

    return pool
  }

  public getPoolForPostgres(): Pool {
    if (this.postgresPool) {
      return this.postgresPool
    }
    const options = this.appConfig.getDatabaseConfig()

    const pool = new Pool({
      database: DEFAULT_DATABASE,
      user: DatabaseRole.POSTGRES,
      password: options.postgres.password || options.postgres.adminPassword,
      host: options.useExternalPool
        ? options.postgres.pool.host!
        : options.postgres.host,
      port: options.useExternalPool
        ? options.postgres.pool.port
        : options.postgres.port,
      ssl: this.appConfig.getDatabaseConfig().postgres.ssl
        ? { rejectUnauthorized: false }
        : undefined,
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: 'nuvix-main',
      keepAliveInitialDelayMillis: 10000,
      max: options.postgres.maxConnections,
      idleTimeoutMillis: 5000,
    })

    pool.on('error', err => {
      this.logger.error('Postgres pool error:', err)
    })

    this.postgresPool = pool
    return pool
  }

  /**
   * Useful where we need a custom client for direct sql execution
   */
  createProjectDbClient(name: string, options?: PoolOptions) {
    let databaseOptions: Partial<PoolOptions> & Record<string, any> = {}
    databaseOptions = {
      ...this.appConfig.getDatabaseConfig().postgres,
      user: DatabaseRole.ADMIN,
      password: this.appConfig.getDatabaseConfig().postgres.adminPassword,
    }
    if (options) {
      databaseOptions = {
        host: options.host,
        port: options.port,
        database: options.database,
        user: options.user,
        password: options.password,
        ssl: this.appConfig.getDatabaseConfig().postgres.ssl
          ? { rejectUnauthorized: false }
          : undefined,
      }
    }

    const pool = new Pool({
      ...databaseOptions,
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: `nuvix-${name}`,
      keepAliveInitialDelayMillis: 10000,
      max: this.appConfig.getDatabaseConfig().postgres.maxConnections,
      idleTimeoutMillis: 5000,
    })

    pool.on('error', err => {
      this.logger.error(`Pool error for ${name}:`, err)
    })

    return pool
  }

  createRedisInstance() {
    if (this.redisInstance) {
      return this.redisInstance
    }
    const redisConfig = this.appConfig.getRedisConfig()
    const connection = new IORedis({
      connectionName: 'nuvix-core',
      ...redisConfig,
      username: redisConfig.user,
      tls: redisConfig.secure ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: 10,
    })
    return connection
  }

  public getRedisInstance(): IORedis {
    if (!this.redisInstance) {
      throw new Exception('Redis instance not initialized')
    }
    return this.redisInstance
  }

  createCache() {
    if (this.cache) {
      return this.cache
    }
    const adapter = new Redis(this.getRedisInstance() as any, {
      namespace: 'nuvix',
    })
    const cache = new Cache(adapter)
    return cache
  }

  public getPlatformAudit() {
    return new Audit(this.getPlatformDb())
  }

  public getPlatform(): Doc<Platform> {
    const data: Platform = {
      auths: {
        limit: 1,
        personalDataCheck: false,
        passwordHistory: 0,
        duration: undefined,
        sessionAlerts: false,
      },
      oAuthProviders: [],
    }

    return new Doc(data)
  }

  getProjectDb(
    client: Client | Pool,
    { projectId, ...options }: GetProjectDBOptions,
  ) {
    const adapter = new Adapter(client)
    adapter
      .setMeta({
        metadata: {
          projectId: projectId,
        },
      })
      .setLogger(this.dbLogger())
    const connection = new Database(adapter, this.getCache())
    connection.setMeta({
      schema: options.schema ?? Schemas.Core,
      namespace: 'nx',
      metadata: { project: projectId },
    })
    connection.setAttachSchemaInDocument(true)
    return connection
  }

  getProjectDevice(projectId: string) {
    const store = new Local(
      path.join(this.appConfig.get('storage').uploads, projectId),
    )
    return store
  }

  getProjectPg(client: Pool | Client, ctx?: Context) {
    ctx = ctx ?? new Context()
    const connection = new DataSource(client, {}, { context: ctx })
    return connection
  }

  createGeoDb(): Reader<CountryResponse> {
    try {
      const buffer = readFileSync(
        path.resolve(
          this.appConfig.assetConfig.root,
          'dbip/dbip-country-lite-2024-09.mmdb',
        ),
      )
      return new Reader<CountryResponse>(buffer)
    } catch (_error) {
      this.logger.warn(
        'GeoIP database not found, country detection will be disabled',
      )
      return {} as any // TODO: return a mock or empty reader
    }
  }

  async createProjectDatabase(
    project: ProjectsDoc,
    options?: CreateProjectDatabaseOptions,
  ) {
    if (!this.projectPool) {
      throw new Error('Project pool is not initialized')
    }
    const dbForProject = this.getProjectDb(this.projectPool, {
      projectId: project.getId(),
      schema: options?.schema,
    })
    return { client: this.projectPool, dbForProject }
  }

  async createProjectPgClient(_project: ProjectsDoc) {
    if (!this.projectPool) {
      throw new Error('Project pool is not initialized')
    }
    return this.projectPool
  }

  /**
   * @deprecated Use connection pools instead
   */
  async releaseDatabaseClient(_client?: Pool | PoolClient) {
    // try {
    //   if (client && 'release' in client) {
    //     client.release()
    //   }
    // } catch (error) {
    //   this.logger.error('Failed to release database client', error)
    // }
  }
}

interface PoolOptions {
  database: string
  user: string
  password?: string
  host: string
  port?: number
}

interface GetProjectDBOptions {
  projectId: string
  schema?: string
}

interface CreateProjectDatabaseOptions {
  schema?: string
}

export interface Platform {
  authWhitelistEmails?: string[]
  authWhitelistIPs?: string[]
  auths: {
    limit?: number
    personalDataCheck?: boolean
    passwordHistory?: number
    duration?: number
    sessionAlerts?: boolean
  }
  oAuthProviders: OAuthProviderType[]
}
