import * as path from 'path';
import { PROJECT_ROOT } from './constants';
import { config } from 'dotenv';
import { Logger } from '@nestjs/common';
import { parseBoolean, parseNumber } from './helpers';

config();

const nxconfig = () =>
  ({
    app: {
      name: 'Nuvix',
      domain: process.env['APP_DOMAIN'] ?? 'localhost',
      hostname: process.env['APP_HOSTNAME'] ?? 'localhost',
      hostnameInternal: process.env['APP_HOSTNAME_INTERNAL'] ?? 'localhost',
      consoleURL: process.env['APP_CONSOLE_URL'] ?? 'http://localhost:3000',
      version: '1.0.0',
      isProduction: process.env['NODE_ENV'] === 'production',
      forceHttps: process.env['APP_FORCE_HTTPS'] === 'disabled',
      emailTeam: process.env['APP_EMAIL_TEAM'] || 'team@localhost.test',
      emailSecurity: process.env['APP_EMAIL_SECURITY'] || '',
      userAgent: 'Nuvix-Server v%s. Please report abuse at %s',
      color: '#477f84',
      debug: {
        colors: parseBoolean(process.env['APP_DEBUG_COLORS'], true),
        json: parseBoolean(process.env['APP_DEBUG_JSON'], false),
      },
      region: process.env['APP_REGION'] || 'local',
    },

    assets: {
      root: path.join(PROJECT_ROOT, process.env['APP_ASSETS_ROOT'] || 'assets'),
      images: path.join(
        PROJECT_ROOT,
        process.env['ASSETS_IMAGES'] || 'assets/images',
      ),
      fonts: path.join(
        PROJECT_ROOT,
        process.env['ASSETS_FONTS'] || 'assets/fonts',
      ),
      templates: path.join(PROJECT_ROOT, 'assets/locale/templates'),
      public: path.join(
        PROJECT_ROOT,
        process.env['APP_ASSETS_PUBLIC'] || 'public',
      ),
      get: (...relativePath: string[]) =>
        path.join(PROJECT_ROOT, ...relativePath),
    },

    security: {
      jwtSecret: process.env['APP_JWT_SECRET'],
      encryptionKey: process.env['APP_ENCRYPTION_KEY'],
      get dbEncryptionKey() {
        const key = process.env['APP_DATABASE_ENCRYPTION_KEY'];
        if (!key) {
          Logger.warn(
            'The environment variable APP_DATABASE_ENCRYPTION_KEY is not set. Using the default encryption key, which is insecure. Please set a custom key in production environments.',
          );
        }
        return key || 'acd3462d9128abcd'; // 16-byte key for AES-128-GCM
      },
    },

    server: {
      host: process.env['APP_HOST'] ?? 'localhost',
      methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE'],
      allowedOrigins: (process.env['CORS_ORIGIN'] ?? '')
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
        'x-nuvix-session',
        ...(process.env['CORS_HEADERS'] ?? '')
          .split(',')
          .map(header => header.trim()),
      ],
      credentials: true,
      exposedHeaders: ['X-Nuvix-Session', 'X-Fallback-Cookies'],
      cookieDomain: process.env['APP_COOKIE_DOMAIN'] ?? '',
      cookieSameSite:
        (process.env['APP_COOKIE_SAMESITE'] as
          | 'none'
          | 'lax'
          | 'strict'
          | undefined) || 'none',
    },

    redis: {
      port: parseNumber(process.env['APP_REDIS_PORT'], 6379),
      host: process.env['APP_REDIS_HOST'],
      user: process.env['APP_REDIS_USER'],
      password: process.env['APP_REDIS_PASSWORD'],
      db: parseNumber(process.env['APP_REDIS_DB'], 0),
      secure: process.env['APP_REDIS_SECURE'] === 'true',
      // -- we will consider to add tls options later
    },

    smtp: {
      host: process.env['APP_SMTP_HOST'],
      port: parseNumber(process.env['APP_SMTP_PORT'], 587),
      secure: process.env['APP_SMTP_SECURE'] === 'true',
      user: process.env['APP_SMTP_USER'],
      password: process.env['APP_SMTP_PASSWORD'],
      emailFrom: process.env['APP_SMTP_EMAIL_FROM'],
      sender: process.env['APP_SMTP_SENDER'],
      replyTo: process.env['APP_SMTP_REPLY_TO'],
      dkim: {
        domain: process.env['APP_SMTP_DKIM_DOMAIN'],
        key: process.env['APP_SMTP_DKIM_KEY'],
        privateKey: process.env['APP_SMTP_DKIM_PRIVATE_KEY'],
      },
    },

    sms: {
      enabled: false,
      // to be implemented
    },

    database: {
      // May be we will support multi tenant later, for now single db (provide same details for all)
      postgres: {
        host: process.env['APP_DATABASE_HOST'] ?? 'localhost',
        port: parseNumber(process.env['APP_DATABASE_PORT'], 5432),
        user: process.env['APP_DATABASE_USER'] ?? 'postgres',
        adminPassword: process.env['APP_DATABASE_ADMIN_PASSWORD'],
        password: process.env['APP_DATABASE_PASSWORD'],
        database: 'postgres', // initial db
        ssl: process.env['APP_DATABASE_SSL'] === 'true',
        maxConnections: parseInt(
          process.env['APP_DATABASE_MAX_CONNECTIONS'] ?? '100',
          10,
        ), // not used currently
        // extrnal pool options (pgcat)
        pool: {
          host: process.env['APP_DATABASE_POOL_HOST'] ?? undefined,
          port: parseNumber(process.env['APP_DATABASE_POOL_PORT'], 6432),
          // user and password can be same as main or different (we enforce same for now)
        },
      },
      platform: {
        host: process.env['APP_DATABASE_HOST'] ?? 'localhost',
        port: parseNumber(process.env['APP_DATABASE_PORT'], 5432),
        user: process.env['APP_DATABASE_USER'] ?? 'nuvix_admin',
        password: process.env['APP_DATABASE_ADMIN_PASSWORD'],
        name: process.env['APP_DATABASE_NAME'] ?? 'platform',
      },
      timeout: 15_000,
      reconnect: {
        sleep: 2,
        maxAttempts: 10,
      },
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
        process.env['APP_STORAGE_MAX_SIZE'],
        5 * (1000 * 1000 * 1000),
      ), // 5GB
      // max bucket size
      limit: parseNumber(
        process.env['APP_STORAGE_LIMIT'],
        10 * (1000 * 1000 * 1000),
      ), // 10GB
      maxOutputChunkSize: 5 * (1000 * 1000), // 5MB
    },

    limits: {
      pagingLimit: parseNumber(process.env['APP_LIMIT_PAGING'], 12),
      maxCount: 10_000,
      limitCount: 5000,
      users: parseNumber(process.env['APP_LIMIT_USERS'], 10_000),
      userPasswordHistory: parseNumber(
        process.env['APP_LIMIT_USER_PASSWORD_HISTORY'],
        10,
      ),
      userSessionsMax: parseNumber(
        process.env['APP_LIMIT_USER_SESSIONS_MAX'],
        100,
      ),
      userSessionsDefault: parseNumber(
        process.env['APP_LIMIT_USER_SESSIONS_DEFAULT'],
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
    },

    access: {
      key: 24 * 60 * 60, // 24 hours
      user: 24 * 60 * 60, // 24 hours
      project: 24 * 60 * 60, // 24 hours
    },

    cache: {
      update: parseNumber(process.env['APP_CACHE_UPDATE'], 24 * 60 * 60), // 24 hours
      buster: 4318,
    },

    system: {
      emailAddress: process.env['SYSTEM_EMAIL_ADDRESS'] ?? 'support@nuvix.in',
      emailName: process.env['APP_NAME'] ?? 'Nuvix Support',
    },

    logLevels: (process.env['APP_LOG_LEVELS'] ?? 'log,error,warn')
      .split(',')
      .map(level => level.trim())
      .filter(level => level),
  }) as const;

export const configuration = nxconfig();

/**
 * Validates that required environment variables and configuration secrets are present and valid.
 *
 * Checks a predefined set of required environment variables (APP_JWT_SECRET, APP_ENCRYPTION_KEY,
 * APP_REDIS_HOST, APP_DATABASE_ADMIN_PASSWORD, APP_DATABASE_PASSWORD) and throws an Error listing
 * any that are missing. Also validates that `configuration.security.dbEncryptionKey` is exactly 16
 * characters long.
 *
 * @throws Error if one or more required environment variables are missing (message lists the missing vars)
 * @throws Error if the database encryption key length is not 16 characters
 */
export function validateRequiredConfig() {
  const requiredVars = [
    'APP_JWT_SECRET',
    'APP_ENCRYPTION_KEY',
    'APP_REDIS_HOST',
    'APP_DATABASE_ADMIN_PASSWORD',
    'APP_DATABASE_PASSWORD',
  ];

  const missing: string[] = [];

  for (const envVar of requiredVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  if (configuration.security.dbEncryptionKey.length !== 16) {
    throw new Error(`DB Encryption key must be 16 characters long`);
  }
}
