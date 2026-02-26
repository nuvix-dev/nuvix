import { readFileSync } from 'node:fs'
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { Audit } from '@nuvix/audit'
import { Cache, Redis } from '@nuvix/cache'
import { Adapter, Database, Logger as DbLogger } from '@nuvix/db'
import { DataSource } from '@nuvix/pg'
import { Device, Local } from '@nuvix/storage'
import {
  configuration,
  DatabaseRole,
  DEFAULT_DATABASE,
  Schemas,
} from '@nuvix/utils'
import { Redis as IORedis } from 'ioredis'
import { CountryResponse, Reader } from 'maxmind'
import { Pool } from 'pg'
import { Exception } from './extend/exception.js'
import { StatsHelper } from './helpers/stats.helper.js'

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
  private readonly cache: Cache | null = null
  private readonly geoDb: Reader<CountryResponse> | null = null
  private readonly redisInstance: IORedis | null = null
  private readonly pool: Pool | null = null
  private readonly postgresPool: Pool | null = null
  private readonly storageDevice: Device | null = null
  private readonly internalDb: Database | null = null
  private readonly database: Database | null = null
  private readonly dataSource: DataSource | null = null

  constructor(private readonly statsHelper: StatsHelper) {
    this.geoDb = this.createGeoDb()
    this.redisInstance = this.createRedisInstance()
    this.cache = this.createCache()
    this.pool = this.createMainPool()

    this.internalDb = this.createInternalDb()
    this.database = this.createDatabase()
    this.dataSource = this.createDataSource()

    if (this.isConsole()) {
      this.postgresPool = this.createPostgresPool()
    } else {
      this.storageDevice = this.createStorageDevice()
    }
  }

  private dbLogger(): DbLogger {
    return new DbLogger({
      level: 'error',
      enabled: configuration.logLevels.includes('error'),
    })
  }

  async onModuleDestroy() {
    if (this.pool) {
      try {
        await this.pool.end()
      } catch (error) {
        this.logger.error('Failed to disconnect main database pool', error)
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

  private createInternalDb() {
    const adapter = new Adapter(this.getPool())
      .setMeta({
        schema: Schemas.Internal,
        sharedTables: false,
        namespace: 'internal',
      })
      .setLogger(this.dbLogger())
    return new Database(adapter, this.getCache())
  }

  private createDatabase() {
    const adapter = new Adapter(this.getPool())
      .setMeta({
        schema: Schemas.Core,
        sharedTables: false,
        namespace: 'nx',
      })
      .setLogger(this.dbLogger())

    const db = new Database(adapter, this.getCache())
    if (!this.isConsole()) {
      this.statsHelper.connect(db)
    }
    return db
  }

  private createDataSource() {
    return new DataSource(this.getPool())
  }

  /**
   * Returns the initialized Database instance for internal use. If the internal database is not initialized, an exception is thrown.
   * @returns {Database} The initialized Database instance for internal use.
   * @throws {Exception} If the internal database is not initialized, an exception is thrown with a message indicating that the internal database is not initialized.
   * @public
   */
  public getInternalDatabase(): Database {
    if (!this.internalDb) {
      throw new Exception('Internal database not initialized')
    }
    return this.internalDb
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

  private createMainPool(): Pool {
    if (this.pool) {
      return this.pool
    }

    const { postgres, timeouts } = configuration.database
    const pool = new Pool({
      database: DEFAULT_DATABASE,
      user: DatabaseRole.ADMIN,
      password: postgres.adminPassword,
      host: postgres.host,
      port: postgres.port,
      ssl: postgres.ssl
        ? { rejectUnauthorized: false } // For simplicity, we are not verifying the SSL certificate. In production, it's recommended to use a valid certificate and set rejectUnauthorized to true.
        : undefined,
      statement_timeout: timeouts.statement,
      query_timeout: timeouts.query,
      idleTimeoutMillis: timeouts.idle,
      connectionTimeoutMillis: timeouts.connection,
      max: postgres.maxConnections,
      min: 2,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      application_name: 'nuvix-core',
      allowExitOnIdle: true,
    })

    pool.on('error', err => {
      this.logger.error('Main database pool error:', err)
    })

    return pool
  }

  private createPostgresPool(): Pool {
    if (this.postgresPool) {
      return this.postgresPool
    }
    const { postgres, timeouts } = configuration.database
    const pool = new Pool({
      database: DEFAULT_DATABASE,
      user: DatabaseRole.POSTGRES,
      password: postgres.password || postgres.adminPassword,
      host: postgres.host,
      port: postgres.port,
      ssl: postgres.ssl ? { rejectUnauthorized: false } : undefined,
      statement_timeout: timeouts.statement,
      query_timeout: timeouts.query,
      idleTimeoutMillis: timeouts.idle,
      connectionTimeoutMillis: timeouts.connection,
      max:
        postgres.maxConnections > 20
          ? Math.floor(postgres.maxConnections / 2)
          : postgres.maxConnections, // limit to 10 for external pool to avoid exhausting connections
      min: 2,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      application_name: 'nuvix-core-pg',
      allowExitOnIdle: true,
    })

    pool.on('error', err => {
      this.logger.error('Postgres database pool error:', err)
    })

    return pool
  }

  public getPool(): Pool {
    if (!this.pool) {
      throw new Exception('Main database pool not initialized')
    }
    return this.pool
  }

  public getPoolForPostgres(): Pool {
    if (!this.postgresPool) {
      throw new Exception('Postgres database pool not initialized')
    }
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
   * Returns the initialized Audit instance for the platform. If the internal database is not initialized, an exception is thrown.
   * @returns {Audit} The initialized Audit instance for the platform.
   * @throws {Exception} If the internal database is not initialized, an exception is thrown with a message indicating that the internal database is not initialized.
   * @public
   */
  public getPlatformAudit(): Audit {
    return new Audit(this.getInternalDatabase())
  }

  /**
   * Returns the initialized Database instance for the main database. If the main database is not initialized, an exception is thrown.
   * @returns {Database} The initialized Database instance for the main database.
   * @throws {Exception} If the main database is not initialized, an exception is thrown with a message indicating that the main database is not initialized.
   * @public
   */
  public getDatabase(): Database {
    if (!this.database) {
      throw new Exception('Main database not initialized')
    }
    return this.database
  }

  /**
   * Returns the initialized DataSource instance for the main database. If the main database is not initialized, an exception is thrown.
   * @returns {DataSource} The initialized DataSource instance for the main database.
   * @throws {Exception} If the main database is not initialized, an exception is thrown with a message indicating that the main database is not initialized.
   * @public
   */
  public getDataSource(): DataSource {
    if (!this.dataSource) {
      throw new Exception('Main data source not initialized')
    }
    return this.dataSource
  }

  /**
   * Returns a Database instance for the specified schema. If the main database pool is not initialized, an exception is thrown.
   * @param {string} schema - The name of the schema for which to get the Database instance.
   * @returns {Database} A Database instance for the specified schema.
   * @throws {Exception} If the main database pool is not initialized, an exception is thrown with a message indicating that the main database pool is not initialized.
   * @public
   */
  public getDatabaseForSchema(schema: string): Database {
    const adapter = new Adapter(this.getPool())
      .setMeta({
        schema,
        sharedTables: false,
        namespace: 'nx',
      })
      .setLogger(this.dbLogger())

    return new Database(adapter, this.getCache())
  }

  /**
   * Returns the initialized Local storage instance for handling file uploads. This method can be extended in the future to support other storage providers like S3, GCS, etc. If the storage device fails to initialize, an exception is thrown with details about the error.
   * @returns {Device} The initialized Local storage instance for handling file uploads.
   * @throws {Exception} If the storage device fails to initialize, an exception is thrown with details about the error.
   * @public
   */
  public getStorageDevice(): Device {
    if (!this.storageDevice) {
      throw new Exception('Storage device not initialized')
    }
    return this.storageDevice
  }

  private createStorageDevice(): Device {
    // For now, we are using Local storage for handling file uploads.
    // In the future, this can be extended to support other storage providers like S3, GCS, etc.
    const storagePath = configuration.storage.uploads
    const device = new Local(storagePath)
    return device
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
