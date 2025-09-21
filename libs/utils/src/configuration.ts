import * as path from 'path';
import { PROJECT_ROOT } from './constants';
import { config } from 'dotenv';
config();

export default () => ({
  app: {
    name: 'Nuvix',
    domain: process.env['APP_DOMAIN'] ?? 'localhost',
    hostname: process.env['APP_HOSTNAME'] ?? 'localhost',
    hostnameInternal: process.env['APP_HOSTNAME_INTERNAL'] ?? 'localhost',
    version: '1.0.0',
    isProduction: process.env['NODE_ENV'] === 'production',
    forceHttps: process.env['APP_OPTIONS_FORCE_HTTPS'] === 'disabled',
    emailTeam: 'team@localhost.test',
    emailSecurity: '',
    userAgent: 'Nuvix-Server v%s. Please report abuse at %s',
    color: '#477f84',
    functionSpecificationDefault: 'default',
    debug: {
      colors: process.env['APP_DEBUG_COLORS'] === 'true',
      format: process.env['APP_DEBUG_FORMAT'] === 'json',
    },
    projects: {
      allowedProdCreate:
        (process.env['APP_PROJECTS_ALLOWED_PROD_CREATE'] ?? 'false') === 'true',
      disabled: (process.env['APP_PROJECTS_DISABLED'] ?? 'false') === 'true',
    },
    devProject: process.env['APP_DEV_PROJECT'],
    region: process.env['APP_REGION'] || 'default',
  },

  assets: {
    root: path.join(PROJECT_ROOT, process.env['ASSETS_ROOT'] || 'assets'),
    images: path.join(
      PROJECT_ROOT,
      process.env['ASSETS_IMAGES'] || 'assets/images',
    ),
    fonts: path.join(
      PROJECT_ROOT,
      process.env['ASSETS_FONTS'] || 'assets/fonts',
    ),
    templates: path.join(PROJECT_ROOT, 'assets/locale/templates'),
    public: path.join(PROJECT_ROOT, process.env['ASSETS_PUBLIC'] || 'public'),
    get: (...relativePath: string[]) =>
      path.join(PROJECT_ROOT, ...relativePath),
  },

  security: {
    jwtSecret: process.env['JWT_SECRET'],
    encryptionKey: process.env['ENCRYPTION_KEY'],
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
    functionsDomain: process.env['APP_DOMAIN_FUNCTION'] ?? '',
    routerProtection:
      (process.env['APP_ROUTER_PROTECTION'] ?? 'true') === 'true',
    cookieDomain: process.env['APP_COOKIE_DOMAIN'] ?? '',
  },

  redis: {
    port: parseInt(process.env['APP_REDIS_PORT'] ?? '6379', 10),
    host: process.env['APP_REDIS_HOST'],
    user: process.env['APP_REDIS_USER'],
    password: process.env['APP_REDIS_PASSWORD'],
    db: parseInt(process.env['APP_REDIS_DB'] ?? '0', 10),
    secure: process.env['APP_REDIS_SECURE'] === 'true',
  },

  smtp: {
    host: process.env['APP_SMTP_HOST'],
    port: parseInt(process.env['APP_SMTP_PORT'] ?? '587', 10),
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
  },

  database: {
    postgres: {
      host: process.env['APP_POSTGRES_HOST'] ?? 'localhost',
      port: parseInt(process.env['APP_POSTGRES_PORT'] ?? '5432', 10),
      user: process.env['APP_POSTGRES_USER'] ?? 'nuvix_admin',
      password: process.env['APP_POSTGRES_PASSWORD'] ?? 'password',
      database: process.env['APP_POSTGRES_DB']!,
      ssl: process.env['APP_POSTGRES_SSL'] === 'true',
      maxConnections: parseInt(
        process.env['APP_POSTGRES_MAX_CONNECTIONS'] ?? '100',
        10,
      ),
    },
    platform: {
      host: process.env['APP_DATABASE_HOST'] ?? 'localhost',
      port: parseInt(process.env['APP_DATABASE_PORT'] ?? '5432', 10),
      user: process.env['APP_DATABASE_USER'] ?? 'nuvix_admin',
      password: process.env['APP_DATABASE_PASSWORD'] ?? 'password',
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
    maxSize: 5 * (1000 * 1000 * 1000), // 5GB
    limit: 10 * (1000 * 1000 * 1000), // 10GB
  },

  limits: {
    pagingLimit: 12,
    maxCount: 1000,
    limitCount: 5000,
    users: 10_000,
    userPasswordHistory: 20,
    userSessionsMax: 100,
    userSessionsDefault: 10,
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
    update: 24 * 60 * 60, // 24 hours
    buster: 4318,
  },

  functions: {
    cpusDefault: 0.5,
    memoryDefault: 512,
  },

  system: {
    emailAddress: 'support@nuvix.in',
    emailName: 'Nuvix',
  },

  logLevels: (process.env['APP_LOG_LEVELS'] ?? '')
    .split(',')
    .map(level => level.trim())
    .filter(level => level)
    .reduce(
      (acc, level) => {
        acc[level.toLowerCase()] = true;
        return acc;
      },
      {} as { [key: string]: boolean },
    ),
});
