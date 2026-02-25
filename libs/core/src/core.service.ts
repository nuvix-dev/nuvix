import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { Audit } from '@nuvix/audit'
import { Cache, Redis } from '@nuvix/cache'
import { Adapter, Database, Logger as DbLogger } from '@nuvix/db'
import { Context, DataSource } from '@nuvix/pg'
import { Local } from '@nuvix/storage'
import {
  configuration,
  DatabaseRole,
  DEFAULT_DATABASE,
  Schemas,
} from '@nuvix/utils'
import IORedis from 'ioredis'
import { CountryResponse, Reader } from 'maxmind'
import { Client, Pool } from 'pg'
import { Exception } from './extend/exception.js'

@Injectable()
export class CoreService implements OnModuleDestroy {
  /**
   * This is used to determine if it's console application or not,
   * since some services are shared between console and server
   */
  private static _isConsole = false

  public static setIsConsole(isConsole: boolean) {
    this._isConsole = isConsole
  }

  public static isConsole() {
    return this._isConsole
  }

  public isConsole() {
    return CoreService.isConsole()
  }

  private readonly logger = new Logger(CoreService.name)
  private cache: Cache | null = null
  private geoDb: Reader<CountryResponse> | null = null
  private redisInstance: IORedis | null = null
  private readonly projectPool: Pool | null = null
  private postgresPool: Pool | null = null

  constructor() {
    this.geoDb = this.createGeoDb()
    this.redisInstance = this.createRedisInstance()
    this.cache = this.createCache()
    this.projectPool = this.createMainPool()
  }

  private dbLogger(): DbLogger {
    return new DbLogger({
      level: 'error',
      enabled: configuration.logLevels.includes('error'),
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
    if (this.postgresPool) {
      try {
        await this.postgresPool.end()
      } catch (error) {
        this.logger.error('Failed to disconnect postgres database pool', error)
      }
    }
  }

  /**
   * Returns the initialized Cache instance. If the cache is not initialized, an exception is thrown.
   * @returns {Cache} The initialized Cache instance.
   * @throws {Exception} If the cache is not initialized, an exception is thrown with a message indicating that the cache is not initialized.
   * @public
   */
  public getCache(): Cache {
    if (!this.cache) {
      throw new Exception('Cache not initialized')
    }
    return this.cache
  }

  /**
   * Returns the initialized Database instance for the platform. If the project database pool is not initialized, an exception is thrown.
   * @returns {Database} The initialized Database instance for the platform.
   * @throws {Exception} If the project database pool is not initialized, an exception is thrown with a message indicating that the project database is not initialized.
   * @public
   */
  public getPlatformDb(): Database {
    if (!this.projectPool) {
      throw new Exception('Project database pool not initialized')
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

  /**
   * Returns the initialized Reader instance for the GeoIP database. If the GeoIP database is not initialized, an exception is thrown.
   * @returns {Reader<CountryResponse>} The initialized Reader instance for the GeoIP database.
   * @throws {Exception} If the GeoIP database is not initialized, an exception is thrown with a message indicating that the GeoIP database is not initialized.
   * @public
   */
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
    if (this.postgresPool) return this.postgresPool

    const options = this.appConfig.getDatabaseConfig()

    this.postgresPool = new Pool({
      database: DEFAULT_DATABASE,
      user: DatabaseRole.POSTGRES,
      password: options.postgres.password || options.postgres.adminPassword,
      host: options.useExternalPool
        ? options.postgres.pool.host!
        : options.postgres.host,
      port: options.useExternalPool
        ? options.postgres.pool.port
        : options.postgres.port,
      ssl: options.postgres.ssl ? { rejectUnauthorized: false } : undefined,
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: 'nuvix-main',
      keepAliveInitialDelayMillis: 10000,
      max:
        options.postgres.maxConnections > 20
          ? options.postgres.maxConnections / 2
          : options.postgres.maxConnections, // limit to 10 for external pool to avoid exhausting connections
      idleTimeoutMillis: 5000,
    })

    this.postgresPool.on('error', err => {
      this.logger.error('Postgres pool error:', err)
    })

    return this.postgresPool
  }

  private createRedisInstance() {
    if (this.redisInstance) {
      return this.redisInstance
    }

    const { secure, ...redisConfig } = configuration.redis
    const connection = new IORedis({
      connectionName: 'nuvix-core',
      ...redisConfig,
      username: redisConfig.user,
      tls: secure ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: 10,
    })

    return connection
  }

  /**
   * Returns the initialized IORedis instance. If the Redis instance is not initialized, an exception is thrown.
   * @returns {IORedis} The initialized IORedis instance.
   * @throws {Exception} If the Redis instance is not initialized, an exception is thrown with a message indicating that the Redis instance is not initialized.
   * @public
   */
  public getRedisInstance(): IORedis {
    if (!this.redisInstance) {
      throw new Exception('Redis instance not initialized')
    }
    return this.redisInstance
  }

  private createCache() {
    if (this.cache) {
      return this.cache
    }
    const adapter = new Redis(this.getRedisInstance() as any, {
      namespace: 'nuvix',
    })
    const cache = new Cache(adapter)
    return cache
  }

  /**
   * Returns the initialized Audit instance for the platform. If the project database pool is not initialized, an exception is thrown.
   * @returns {Audit} The initialized Audit instance for the platform.
   * @throws {Exception} If the project database pool is not initialized, an exception is thrown with a message indicating that the project database is not initialized.
   * @public
   */
  public getPlatformAudit() {
    return new Audit(this.getPlatformDb())
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

  /**
   * Loads the GeoIP database from the specified path and creates a Reader instance.
   * If the database fails to load, an exception is thrown with details about the error.
   * @returns {Reader<CountryResponse>} A Reader instance for the GeoIP database.
   * @throws {Exception} If the GeoIP database fails to load, an exception is thrown with details about the error.
   * @private
   */
  private createGeoDb(): Reader<CountryResponse> {
    try {
      const buffer = readFileSync(
        configuration.assets.resolve('dbip', 'dbip-country-lite-2024-09.mmdb'),
      )
      return new Reader<CountryResponse>(buffer)
    } catch (error) {
      throw new Exception('Failed to load GeoIP database').addDetails({ error })
    }
  }
}
