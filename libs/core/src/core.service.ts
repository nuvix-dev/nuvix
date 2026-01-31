import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { AppConfigService } from './config.service.js'
import { Client, Pool, PoolClient } from 'pg'
import IORedis from 'ioredis'
import { Cache, Redis } from '@nuvix/cache'
import { Adapter, Database, Doc, Logger as DbLogger } from '@nuvix/db'
import { Audit } from '@nuvix/audit'
import { Local } from '@nuvix/storage'
import { DataSource, Context } from '@nuvix/pg'
import { Reader, CountryResponse } from 'maxmind'
import { readFileSync } from 'fs'
import path from 'path'
import type { ProjectsDoc } from '@nuvix/utils/types'
import { DatabaseRole, DEFAULT_DATABASE, Schemas } from '@nuvix/utils'
import type { OAuthProviderType } from './config/authProviders.js'
import { Exception } from './extend/exception.js'

@Injectable()
export class CoreService implements OnModuleDestroy {
  private readonly logger = new Logger(CoreService.name)
  private cache: Cache | null = null
  private geoDb: Reader<CountryResponse> | null = null
  private readonly projectPool: Pool | null = null

  constructor(private readonly appConfig: AppConfigService) {
    this.geoDb = this.createGeoDb()
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
  }

  public getCache(): Cache {
    if (!this.cache) throw new Exception('Cache not initialized')
    return this.cache
  }

  public getPlatformDb(): Database {
    if (!this.projectPool) throw new Exception('Project DB not initialized')
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
    if (!this.geoDb) throw new Exception('Geo DB not initialized')
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

  createCacheDb() {
    const redisConfig = this.appConfig.getRedisConfig()
    const connection = new IORedis({
      connectionName: 'CACHE_DB',
      ...redisConfig,
      username: redisConfig.user,
      tls: redisConfig.secure ? { rejectUnauthorized: false } : undefined,
    })
    return connection
  }

  createCache() {
    if (this.cache) {
      return this.cache
    }
    const redisConfig = this.appConfig.getRedisConfig()
    const adapter = new Redis({
      ...redisConfig,
      username: redisConfig.user,
      tls: redisConfig.secure ? { rejectUnauthorized: false } : undefined,
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
      path.join(this.appConfig.get('storage')['uploads'], projectId),
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
    } catch (error) {
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

  async createProjectPgClient(project: ProjectsDoc) {
    if (!this.projectPool) {
      throw new Error('Project pool is not initialized')
    }
    return this.projectPool
  }

  /**
   * @deprecated Use connection pools instead
   */
  async releaseDatabaseClient(client?: Pool | PoolClient) {
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
