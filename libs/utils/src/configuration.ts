import * as path from 'path'
import { PROJECT_ROOT } from './constants'
import { Logger } from '@nestjs/common'
import { parseBoolean, parseNumber } from './helpers'

type CookieSameSite = 'none' | 'lax' | 'strict'

const nxconfig = () =>
  ({
    app: {
      name: 'Nuvix',
      domain: process.env['NUVIX_DOMAIN'] ?? 'localhost',
      hostname: process.env['NUVIX_HOSTNAME'] ?? 'localhost',
      hostnameInternal: process.env['NUVIX_HOSTNAME_INTERNAL'] ?? 'localhost',
      consoleURL: process.env['NUVIX_CONSOLE_URL'] ?? 'http://localhost:3000',
      version: '1.0.0',
      isProduction: process.env['NODE_ENV'] === 'production',
      forceHttps: process.env['NUVIX_FORCE_HTTPS'] !== 'disabled',
      emailTeam: process.env['NUVIX_EMAIL_TEAM'] || 'team@localhost.test',
      emailSecurity: process.env['NUVIX_EMAIL_SECURITY'] || '',
      userAgent: 'Nuvix-Server v%s. Please report abuse at %s',
      color: '#ff751f',
      debug: {
        colors: parseBoolean(process.env['NUVIX_DEBUG_COLORS'], true),
        json: parseBoolean(process.env['NUVIX_DEBUG_JSON'], false),
      },
      region: process.env['NUVIX_REGION'] || 'local',
      enableLogs: parseBoolean(process.env['NUVIX_ENABLE_LOGS'], true),
      enableStats: parseBoolean(process.env['NUVIX_ENABLE_STATS'], true),
      docsRoot: process.env['NUVIX_DOCS_ROOT'] || PROJECT_ROOT,
      projectId: process.env['NUVIX_PROJECT_ID'] || 'default',
    },

    assets: {
      root: path.join(
        PROJECT_ROOT,
        process.env['NUVIX_ASSETS_ROOT'] || 'assets',
      ),
      get images() {
        return path.join(configuration.assets.root, 'images')
      },
      get fonts() {
        return path.join(configuration.assets.root, 'fonts')
      },
      get templates() {
        return path.join(configuration.assets.root, 'locale', 'templates')
      },
      public: path.join(
        PROJECT_ROOT,
        process.env['NUVIX_ASSETS_PUBLIC'] || 'public',
      ),
      get: (...relativePath: string[]) =>
        path.join(configuration.assets.root, ...relativePath),
    },

    security: {
      jwtSecret: process.env['NUVIX_JWT_SECRET'],
      encryptionKey: process.env['NUVIX_ENCRYPTION_KEY'],
      get dbEncryptionKey() {
        const key = process.env['NUVIX_DATABASE_ENCRYPTION_KEY']
        if (!key) {
          Logger.warn(
            'The environment variable NUVIX_DATABASE_ENCRYPTION_KEY is not set. Using the default encryption key, which is insecure. Please set a custom key in production environments.',
          )
        }
        return key || 'acd3462d9128abcd' // 16-byte key for AES-128-GCM
      },
    },

    server: {
      host: process.env['NUVIX_HOST'] ?? 'localhost',
      methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE'],
      allowedOrigins: (process.env['NUVIX_CORS_ORIGIN'] ?? '')
        .split(',')
        .map(origin => origin.trim()),
      allowedHeaders: [
        'Content-Type',
        'Content-Length',
        'Authorization',
        'X-Requested-With',
        'X-HTTP-Method-Override',
        'Accept',
        'range',
        'X-Nuvix-Project',
        'X-Nuvix-Key',
        'X-Nuvix-Locale',
        'X-Nuvix-Mode',
        'X-Nuvix-JWT',
        'X-Nuvix-id',
        'X-Nuvix-Response-Format',
        'X-Nuvix-Timeout',
        'x-sdk-language',
        'x-sdk-name',
        'x-sdk-platform',
        'x-sdk-version',
        'content-range',
        'x-fallback-cookies',
        'x-Nuvix-session',
        ...(process.env['NUVIX_CORS_HEADERS'] ?? '')
          .split(',')
          .map(header => header.trim()),
      ],
      credentials: true,
      exposedHeaders: ['X-Nuvix-Session', 'X-Fallback-Cookies'],
      cookieDomain: process.env['NUVIX_COOKIE_DOMAIN'] ?? '',
      cookieSameSite:
        (process.env['NUVIX_COOKIE_SAMESITE'] as CookieSameSite | undefined) ||
        'none',
    },

    redis: {
      port: parseNumber(process.env['NUVIX_REDIS_PORT'], 6379),
      host: process.env['NUVIX_REDIS_HOST'],
      user: process.env['NUVIX_REDIS_USER'],
      password: process.env['NUVIX_REDIS_PASSWORD'],
      db: parseNumber(process.env['NUVIX_REDIS_DB'], 0),
      secure: process.env['NUVIX_REDIS_SECURE'] === 'true',
      // -- we will consider to add tls options later
    },

    smtp: {
      host: process.env['NUVIX_SMTP_HOST'],
      port: parseNumber(process.env['NUVIX_SMTP_PORT'], 587),
      secure: process.env['NUVIX_SMTP_SECURE'] === 'true',
      user: process.env['NUVIX_SMTP_USER'],
      password: process.env['NUVIX_SMTP_PASSWORD'],
      emailFrom: process.env['NUVIX_SMTP_EMAIL_FROM'],
      sender: process.env['NUVIX_SMTP_SENDER'],
      replyTo: process.env['NUVIX_SMTP_REPLY_TO'],
      dkim: {
        domain: process.env['NUVIX_SMTP_DKIM_DOMAIN'],
        key: process.env['NUVIX_SMTP_DKIM_KEY'],
        privateKey: process.env['NUVIX_SMTP_DKIM_PRIVATE_KEY'],
      },
    },

    sms: {
      enabled: false,
      // to be implemented
    },

    database: {
      // May be we will support multi tenant later, for now single db (provide same details for all)
      postgres: {
        host: process.env['NUVIX_DATABASE_HOST'] ?? 'localhost',
        port: parseNumber(process.env['NUVIX_DATABASE_PORT'], 5432),
        user: process.env['NUVIX_DATABASE_USER'] ?? 'postgres',
        adminPassword: process.env['NUVIX_DATABASE_ADMIN_PASSWORD'],
        password: process.env['NUVIX_DATABASE_PASSWORD'],
        database: 'postgres', // initial db
        ssl: process.env['NUVIX_DATABASE_SSL'] === 'true',
        maxConnections: parseInt(
          process.env['NUVIX_DATABASE_MAX_CONNECTIONS'] ?? '100',
          10,
        ), // not used currently
        // extrnal pool options (pgcat)
        pool: {
          host: process.env['NUVIX_DATABASE_POOL_HOST'] ?? undefined,
          port: parseNumber(process.env['NUVIX_DATABASE_POOL_PORT'], 6432),
          // user and password can be same as main or different (we enforce same for now)
        },
      },
      timeout: 15_000,
      reconnect: {
        sleep: 2,
        maxAttempts: 10,
      },
      useExternalPool: parseBoolean(
        process.env['NUVIX_DATABASE_USE_EXTERNAL_POOL'],
        false,
      ),
    },

    storage: {
      uploads: path.join(PROJECT_ROOT, 'storage/uploads'),
      cache: 'storage/cache',
      certificates: 'storage/certificates',
      config: 'storage/config',
      temp: path.join(PROJECT_ROOT, 'storage/tmp'),
      readBuffer: 20 * (1000 * 1000), // 20MB
      // max file size for upload
      maxSize: parseNumber(
        process.env['NUVIX_STORAGE_MAX_SIZE'],
        5 * (1000 * 1000 * 1000),
      ), // 5GB
      // max bucket size
      limit: parseNumber(
        process.env['NUVIX_STORAGE_LIMIT'],
        10 * (1000 * 1000 * 1000),
      ), // 10GB
      maxOutputChunkSize: 5 * (1000 * 1000), // 5MB
    },

    limits: {
      pagingLimit: parseNumber(process.env['NUVIX_LIMIT_PAGING'], 12),
      maxCount: 10_000,
      limitCount: 5000,
      users: parseNumber(process.env['NUVIX_LIMIT_USERS'], 10_000),
      userPasswordHistory: parseNumber(
        process.env['NUVIX_LIMIT_USER_PASSWORD_HISTORY'],
        10,
      ),
      userSessionsMax: parseNumber(
        process.env['NUVIX_LIMIT_USER_SESSIONS_MAX'],
        100,
      ),
      userSessionsDefault: parseNumber(
        process.env['NUVIX_LIMIT_USER_SESSIONS_DEFAULT'],
        10,
      ),
      antivirus: 20_000_000, // 20MB
      encryption: 20_000_000, // 20MB
      compression: 20_000_000, // 20MB
      arrayParamsSize: 100,
      arrayLabelsSize: 1000,
      arrayElementSize: 4096,
      subquery: 1000,
      subscribersSubquery: 1_000_000,
      writeRateDefault: 60,
      writeRatePeriodDefault: 60,
      listDefault: 25,
      batchSize: parseNumber(process.env['NUVIX_BATCH_SIZE'], 2000),
      batchIntervalMs: parseNumber(
        process.env['NUVIX_BATCH_INTERVAL_MS'],
        5000,
      ),
    },

    access: {
      key: 24 * 60 * 60, // 24 hours
      user: 24 * 60 * 60, // 24 hours
      project: 24 * 60 * 60, // 24 hours
    },

    cache: {
      update: parseNumber(process.env['NUVIX_CACHE_UPDATE'], 24 * 60 * 60), // 24 hours
      buster: 4318,
    },

    system: {
      emailAddress:
        process.env['NUVIX_SYSTEM_EMAIL_ADDRESS'] ?? 'support@nuvix.in',
      emailName: process.env['NUVIX_NAME'] ?? 'Nuvix Support',
    },

    logLevels: (process.env['NUVIX_LOG_LEVELS'] ?? 'log,error,warn')
      .split(',')
      .map(level => level.trim())
      .filter(level => level),
  }) as const

export const configuration = nxconfig()

export function validateRequiredConfig() {
  const requiredVars: readonly string[] = [
    'NUVIX_JWT_SECRET',
    'NUVIX_ENCRYPTION_KEY',
    'NUVIX_REDIS_HOST',
    'NUVIX_DATABASE_ADMIN_PASSWORD',
    'NUVIX_DATABASE_PASSWORD',
    'NUVIX_PROJECT_ID',
  ] as const

  const missing: string[] = requiredVars.filter(envVar => !process.env[envVar])

  const isProduction = process.env['NODE_ENV'] === 'production'
  if (isProduction && !process.env['NUVIX_DATABASE_ENCRYPTION_KEY']) {
    missing.push('NUVIX_DATABASE_ENCRYPTION_KEY')
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    )
  }

  const dbKey =
    process.env['NUVIX_DATABASE_ENCRYPTION_KEY'] ??
    configuration.security.dbEncryptionKey

  const keyBytes = Buffer.byteLength(dbKey, 'utf8')
  const validKeySizes = [16, 24, 32] as const

  if (!validKeySizes.includes(keyBytes as 16 | 24 | 32)) {
    throw new Error(
      `DB Encryption key must be 16, 24, or 32 bytes (AES-128/192/256). Current size: ${keyBytes} bytes`,
    )
  }
}
