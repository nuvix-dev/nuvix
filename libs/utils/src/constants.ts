// TODO: use enums for constants where applicable
import * as path from 'path';
import * as fs from 'fs';
import { ServerConfig } from './types';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

config();

/**
 * Finds the project root directory by traversing up the directory tree
 * until a package.json file is found
 * @returns Absolute path to the project root directory
 * @throws Error if project root directory cannot be found
 */
function findProjectRoot(): string {
  try {
    // Start from current file's directory
    let currentDir: string;
    if (import.meta.url) {
      currentDir = path.dirname(fileURLToPath(import.meta.url));
    } else {
      currentDir = __dirname;
    }
    const maxDepth = 10; // Prevent infinite loops
    let depth = 0;

    while (currentDir !== '/' && depth < maxDepth) {
      const packageJsonPath = path.join(currentDir, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        return currentDir;
      }

      const parentDir = path.dirname(currentDir);
      // Check if we've reached the top (when dirname doesn't change the path anymore)
      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
      depth++;
    }

    // Fallback to current working directory if not found
    console.warn('Could not find package.json, falling back to process.cwd()');
    return process.cwd();
  } catch (error) {
    console.error('Error finding project root:', error);
    throw new Error('Failed to determine project root directory');
  }
}

export const PROJECT_ROOT = findProjectRoot();

// Asset paths configuration
/**@deprecated */ export const ASSETS = {
  ROOT: path.join(PROJECT_ROOT, process.env['ASSETS_ROOT'] || 'assets'),
  IMAGES: path.join(
    PROJECT_ROOT,
    process.env['ASSETS_IMAGES'] || 'assets/images',
  ),
  FONTS: path.join(PROJECT_ROOT, process.env['ASSETS_FONTS'] || 'assets/fonts'),
  TEMPLATES: path.join(PROJECT_ROOT, 'assets/locale/templates'),
  PUBLIC: path.join(PROJECT_ROOT, process.env['ASSETS_PUBLIC'] || 'public'),
  get: (relativePath: string) => path.join(PROJECT_ROOT, relativePath),
};

export const JWT_SECRET = process.env['JWT_SECRET'];
export const PYTHON_API_URL = process.env['PYTHON_API_URL'];
export const ENCRYPTION_KEY = process.env['ENCRYPTION_KEY'];
export const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';

/**@deprecated */ export const APP_VERSION_STABLE = '1.0.0';
/**@deprecated */ export const APP_FUNCTION_SPECIFICATION_DEFAULT = 'default';
export const APP_DATABASE_ENCRYPTION_KEY = 'acd3462d9128abcd'; // 16-byte key for AES-128-GCM

/**@deprecated */ export const APP_REDIS_PORT = parseInt(
  process.env['APP_REDIS_PORT'] ?? '6379',
  10,
);
/**@deprecated */ export const APP_REDIS_HOST = process.env['APP_REDIS_HOST'];
/**@deprecated */ export const APP_REDIS_USER = process.env['APP_REDIS_USER'];
/**@deprecated */ export const APP_REDIS_PASSWORD =
  process.env['APP_REDIS_PASSWORD'];
/**@deprecated */ export const APP_REDIS_DB = parseInt(
    process.env['APP_REDIS_DB'] ?? '0',
    10,
  );
/**@deprecated */ export const APP_REDIS_SECURE =
  process.env['APP_REDIS_SECURE'] === 'true';

// Email Config
/**@deprecated */ export const APP_SMTP_HOST = process.env['APP_SMTP_HOST'];
/**@deprecated */ export const APP_SMTP_PORT = parseInt(
    process.env['APP_SMTP_PORT'] ?? '587',
    10,
  );
/**@deprecated */ export const APP_SMTP_SECURE =
  process.env['APP_SMTP_SECURE'] === 'true';
/**@deprecated */ export const APP_SMTP_USER = process.env['APP_SMTP_USER'];
/**@deprecated */ export const APP_SMTP_PASSWORD =
  process.env['APP_SMTP_PASSWORD'];
/**@deprecated */ export const APP_SMTP_EMAIL_FROM =
  process.env['APP_SMTP_EMAIL_FROM'];
/**@deprecated */ export const APP_SMTP_SENDER = process.env['APP_SMTP_SENDER'];
/**@deprecated */ export const APP_SMTP_REPLY_TO =
  process.env['APP_SMTP_REPLY_TO'];
/**@deprecated */ export const APP_SMTP_DKIM_DOMAIN =
  process.env['APP_SMTP_DKIM_DOMAIN'];
/**@deprecated */ export const APP_SMTP_DKIM_KEY =
  process.env['APP_SMTP_DKIM_KEY'];
/**@deprecated */ export const APP_SMTP_DKIM_PRIVATE_KEY =
  process.env['APP_SMTP_DKIM_PRIVATE_KEY'];

// Database Config
// PostgreSQL
export const APP_POSTGRES_HOST =
  process.env['APP_POSTGRES_HOST'] ?? 'localhost';
export const APP_POSTGRES_PORT = parseInt(
  process.env['APP_POSTGRES_PORT'] ?? '5432',
  10,
);
/**@deprecated */ export const APP_POSTGRES_USER =
  process.env['APP_POSTGRES_USER'];
/**@deprecated */ export const APP_POSTGRES_PASSWORD =
  process.env['APP_POSTGRES_PASSWORD'];
/**@deprecated */ export const APP_POSTGRES_DB = process.env['APP_POSTGRES_DB'];
/**@deprecated */ export const APP_POSTGRES_SSL =
  process.env['APP_POSTGRES_SSL'] === 'true';
/**@deprecated */ export const APP_POSTGRES_MAX_CONNECTIONS = parseInt(
    process.env['APP_POSTGRES_MAX_CONNECTIONS'] ?? '100',
    10,
  );
/**@deprecated */ export const APP_SHARED_CLUSTER = true; // Multi-cluster mode not supported yet!
// Console DB
/**@deprecated */ export const APP_DATABASE_HOST =
  process.env['APP_DATABASE_HOST'] ?? 'localhost';
/**@deprecated */ export const APP_DATABASE_USER =
  process.env['APP_DATABASE_USER'];
/**@deprecated */ export const APP_DATABASE_PASSWORD =
  process.env['APP_DATABASE_PASSWORD'];
/**@deprecated */ export const APP_DATABASE_NAME =
  process.env['APP_DATABASE_NAME'];
/**@deprecated */ export const APP_DATABASE_PORT = parseInt(
    process.env['APP_DATABASE_PORT'] ?? '3306',
    10,
  );

/**@deprecated */ export const APP_INTERNAL_POOL_API =
  process.env['APP_POOL_API'];

/**@deprecated */ export const PROJECT = 'project';
/**@deprecated */ export const USER = 'user';
/**@deprecated */ export const TEAM = 'team';
/**@deprecated */ export const SESSION = 'session';

/**@deprecated Symbol used to identify the database connection for the platform. */
export const DB_FOR_PLATFORM = Symbol('dbForPlatform');
/**@deprecated Symbol used to identify the operation for getting a project database client. */
export const GET_PROJECT_DB_CLIENT = Symbol('get-db-client');
/**@deprecated Symbol used to identify the operation for getting a project database. */
export const GET_PROJECT_DB = Symbol('getProjectDb');
/**@deprecated Symbol used to identify the operation for getting a project PostgreSQL database. */
export const GET_PROJECT_PG = Symbol('getProjectPostgreDb');
/** Symbol used to identify the project database client instance. */
export const PROJECT_DB_CLIENT = Symbol('project-db-client');
/**@deprecated Symbol used to identify the project database instance. */
export const PROJECT_DB = Symbol('project-db');
/** Symbol used to identify the project PostgreSQL database instance. */
export const PROJECT_PG = Symbol('project-pg');
/**@deprecated Symbol used to identify the cache database instance. */
export const CACHE_DB = Symbol('cacheDb');
/**@deprecated Symbol used to identify the geographic database instance. */
export const GEO_DB = Symbol('geoDb');
/**@deprecated Symbol used to identify the operation for retrieving a device associated with a specific project. */
export const GET_DEVICE_FOR_PROJECT = Symbol('getDeviceForProject');

/**@deprecated */ export const AUDITS_FOR_PLATFORM =
  Symbol('auditsForPlatform');
export const AUDITS_FOR_PROJECT = Symbol('auditsForProject');

/** @deprecated */ export const CACHE = 'cache';
export const IS_PUBLIC_KEY = 'isPublic';
/**@deprecated */ export const LOCALE = 'locale';
/**@deprecated */ export const API_KEY = 'apiKey';
/**@deprecated */ export const SCOPES = 'scopes';
/**@deprecated */ export const ROLE = 'role';
export const HOOKS = 'hooks';
export const APP_COLOR = '#f67520';
export const DEFAULT_DATABASE = 'postgres';

export const CORE_SCHEMA_DB = Symbol('coreSchemaDb');
export const AUTH_SCHEMA_DB = Symbol('authSchemaDb');
export const CURRENT_SCHEMA_DB = Symbol('currentSchemaDb');
export const CURRENT_SCHEMA_PG = Symbol('currentSchemaPg');

/**@deprecated */ export const INTERNAL_SCHEMAS = ['system', 'core'] as const;

/**@deprecated */ export const SYSTEM_SCHEMA = 'system' as const;
/**@deprecated */ export const CORE_SCHEMA = 'core' as const;

const allowedHeaders = [
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
];

/**@deprecated */ export const CONSOLE_CONFIG: any = {
  auths: {},
};
/**@deprecated */ export const SERVER_CONFIG: ServerConfig = {
  host: process.env['APP_HOSTNAME'] ?? 'localhost',
  methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedOrigins: (process.env['CORS_ORIGIN'] ?? '').split(',').map(origin => {
    origin = origin.trim();
    // Convert wildcard subdomains to regex patterns
    if (origin.includes('*')) {
      return new RegExp('^' + origin.replace(/\*/g, '.*') + '$');
    }
    return origin;
  }),
  allowedHeaders: [
    ...allowedHeaders,
    ...(process.env['CORS_HEADERS'] ?? '')
      .split(',')
      .map(header => header.trim()),
  ],
  credentials: true,
  exposedHeaders: ['X-Nuvix-Session', 'X-Fallback-Cookies'],
  functionsDomain: process.env['APP_DOMAIN_FUNCTION'] ?? '',
  routerProtection: (process.env['APP_ROUTER_PROTECTION'] ?? 'true') === 'true',
  cookieDomain: process.env['APP_COOKIE_DOMAIN'] ?? '',
};

export const LOG_LEVELS: { [key: string]: boolean; } = (
  process.env['APP_LOG_LEVELS'] ?? ''
)
  .split(',')
  .map(level => level.trim())
  .filter(level => level)
  .reduce(
    (acc, level) => {
      acc[level.toLowerCase()] = true;
      return acc;
    },
    {} as { [key: string]: boolean; },
  );

// APP
export const APP_NAME = 'Nuvix';
export const APP_DOMAIN = process.env['APP_DOMAIN'] ?? 'localhost';
export const APP_OPTIONS_FORCE_HTTPS =
  process.env['APP_OPTIONS_FORCE_HTTPS'] ?? false;
export const APP_EMAIL_TEAM = 'team@localhost.test'; // Default email address
export const APP_EMAIL_SECURITY = ''; // Default security email address
export const APP_USERAGENT =
  APP_NAME + '-Server v%s. Please report abuse at %s';
/**@deprecated */ export const APP_PAGING_LIMIT = 12;
export const APP_MAX_COUNT = 1000;
export const APP_LIMIT_COUNT = 5000;
/**@deprecated */ export const APP_LIMIT_USERS = 10_000;
/**@deprecated */ export const APP_LIMIT_USER_PASSWORD_HISTORY = 20;
/**@deprecated */ export const APP_LIMIT_USER_SESSIONS_MAX = 100;
export const APP_LIMIT_USER_SESSIONS_DEFAULT = 10;
/**@deprecated */ export const APP_LIMIT_ANTIVIRUS = 20_000_000; //20MB
/**@deprecated */ export const APP_LIMIT_ENCRYPTION = 20_000_000; //20MB
/**@deprecated */ export const APP_LIMIT_COMPRESSION = 20_000_000; //20MB
export const APP_LIMIT_ARRAY_PARAMS_SIZE = 100; // Default maximum of how many elements can there be in API parameter that expects array value
export const APP_LIMIT_ARRAY_LABELS_SIZE = 1000; // Default maximum of how many labels elements can there be in API parameter that expects array value
export const APP_LIMIT_ARRAY_ELEMENT_SIZE = 4096; // Default maximum length of element in array parameter represented by maximum URL length.
export const APP_LIMIT_SUBQUERY = 1000;
export const APP_LIMIT_SUBSCRIBERS_SUBQUERY = 1_000_000;
/**@deprecated */ export const APP_LIMIT_WRITE_RATE_DEFAULT = 60; // Default maximum write rate per rate period
/**@deprecated */ export const APP_LIMIT_WRITE_RATE_PERIOD_DEFAULT = 60; // Default maximum write rate period in seconds
/**@deprecated */ export const APP_LIMIT_LIST_DEFAULT = 25; // Default maximum number of items to return in list API calls
/**@deprecated */ export const APP_KEY_ACCESS = 24 * 60 * 60; // 24 hours
/**@deprecated */ export const APP_USER_ACCESS = 24 * 60 * 60; // 24 hours
/**@deprecated */ export const APP_PROJECT_ACCESS = 24 * 60 * 60; // 24 hours
/**@deprecated */ export const APP_CACHE_UPDATE = 24 * 60 * 60; // 24 hours
/**@deprecated */ export const APP_CACHE_BUSTER = 4318;
/**@deprecated */ export const APP_DATABASE_ATTRIBUTE_EMAIL = 'email';
/**@deprecated */ export const APP_DATABASE_ATTRIBUTE_ENUM = 'enum';
/**@deprecated */ export const APP_DATABASE_ATTRIBUTE_IP = 'ip';
/**@deprecated */ export const APP_DATABASE_ATTRIBUTE_DATETIME = 'datetime';
/**@deprecated */ export const APP_DATABASE_ATTRIBUTE_URL = 'url';
/**@deprecated */ export const APP_DATABASE_ATTRIBUTE_INT_RANGE = 'intRange';
/**@deprecated */ export const APP_DATABASE_ATTRIBUTE_FLOAT_RANGE =
  'floatRange';
export const APP_DATABASE_ATTRIBUTE_STRING_MAX_LENGTH = 1_073_741_824; // 2^32 bits / 4 bits per char
export const APP_DATABASE_TIMEOUT_MILLISECONDS = 15_000;
export const APP_STORAGE_UPLOADS = path.join(PROJECT_ROOT, 'storage/uploads');
/**@deprecated */ export const APP_STORAGE_FUNCTIONS = 'storage/functions';
/**@deprecated */ export const APP_STORAGE_BUILDS = 'storage/builds';
/**@deprecated */ export const APP_STORAGE_CACHE = 'storage/cache';
/**@deprecated */ export const APP_STORAGE_CERTIFICATES =
  'storage/certificates';
/**@deprecated */ export const APP_STORAGE_CONFIG = 'storage/config';
export const APP_STORAGE_TEMP = path.join(PROJECT_ROOT, 'storage/tmp');
export const APP_STORAGE_READ_BUFFER = 20 * (1000 * 1000); //20MB other names `APP_STORAGE_MEMORY_LIMIT`, `APP_STORAGE_MEMORY_BUFFER`, `APP_STORAGE_READ_LIMIT`, `APP_STORAGE_BUFFER_LIMIT`
export const APP_STORAGE_MAX_SIZE = 5 * (1000 * 1000 * 1000); // 5GB
export const APP_STORAGE_LIMIT = 10 * (1000 * 1000 * 1000); // 10GB
export const APP_HOSTNAME_INTERNAL =
  process.env['APP_HOSTNAME_INTERNAL'] ?? 'localhost';

// Debug
export const APP_DEBUG_COLORS = process.env['APP_DEBUG_COLORS'] === 'true';
export const APP_DEBUG_FORMAT = process.env['APP_DEBUG_FORMAT'] === 'json';

/**@deprecated */ export const WORKER_TYPE_MAILS = 'mails';
/**@deprecated */ export const WORKER_TYPE_MESSAGING = 'messaging';

// Mails
/**@deprecated */ export const APP_SYSTEM_EMAIL_ADDRESS = 'app@nuvix.in';
/**@deprecated */ export const APP_SYSTEM_EMAIL_NAME = 'Nuvix';
/**@deprecated */ export const SEND_TYPE_EMAIL = 'sendEmail';

// Database Reconnect
export const DATABASE_RECONNECT_SLEEP = 2;
export const DATABASE_RECONNECT_MAX_ATTEMPTS = 10;

// Database Worker Types
/**@deprecated */ export const DATABASE_TYPE_CREATE_ATTRIBUTE =
  'createAttribute' as const;
/**@deprecated */ export const DATABASE_TYPE_CREATE_INDEX =
  'createIndex' as const;
/**@deprecated */ export const DATABASE_TYPE_DELETE_ATTRIBUTE =
  'deleteAttribute' as const;
/**@deprecated */ export const DATABASE_TYPE_DELETE_INDEX =
  'deleteIndex' as const;
/**@deprecated */ export const DATABASE_TYPE_DELETE_COLLECTION =
  'deleteCollection' as const;
/**@deprecated */ export const DATABASE_TYPE_DELETE_DATABASE =
  'deleteDatabase' as const;

// Auth Types
export const APP_AUTH_TYPE_SESSION = 'Session';
export const APP_AUTH_TYPE_JWT = 'JWT';
export const APP_AUTH_TYPE_KEY = 'Key';
export const APP_AUTH_TYPE_ADMIN = 'Admin';
// Response related
export const MAX_OUTPUT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

export enum AppMode {
  ADMIN = 'admin',
  DEFAULT = 'default',
}

export enum ApiKey {
  STANDARD = 'standard',
  DYNAMIC = 'dynamic',
  DEV = 'dev',
}

export enum Schemas {
  Auth = 'auth',
  Core = 'core',
  System = 'system',
}

export enum SchemaType {
  Managed = 'managed',
  Unmanaged = 'unmanaged',
  Document = 'document',
}

export enum SchemaMeta {
  collections = '_collections',
  attributes = '_attributes',
  indexes = '_indexes',
}

export enum QueueFor {
  AUDITS = 'audits',
  PROJECTS = 'projects',
  FUNCTIONS = 'functions',
  MESSAGING = 'messaging',
  DATABASES = 'databases',
  MAILS = 'mails',
  COLLECTIONS = 'collections',
  STATS = 'stats',
  LOGS = 'logs',
}

export const EVENT_DELIMITER = '.';
export enum AppEvents {
  USER_CREATE = 'user' + EVENT_DELIMITER + 'create',
  USER_DELETE = 'user' + EVENT_DELIMITER + 'delete',
  USER_UPDATE = 'user' + EVENT_DELIMITER + 'update',
  SESSION_CREATE = 'session' + EVENT_DELIMITER + 'create',
  SESSION_DELETE = 'session' + EVENT_DELIMITER + 'delete',
  SESSIONS_DELETE = 'sessions' + EVENT_DELIMITER + 'delete',
  SESSION_UPDATE = 'session' + EVENT_DELIMITER + 'update',
}

export enum MetricFor {
  USERS = 'users',
  TEAMS = 'teams',
  AUTH_METHOD_PHONE = 'auth.method.phone',
  AUTH_METHOD_PHONE_COUNTRY_CODE = 'auth.method.phone.{countryCode}',
  MESSAGES = 'messages',
  MESSAGES_SENT = 'messages.sent',
  MESSAGES_FAILED = 'messages.failed',
  MESSAGES_TYPE = 'messages.{type}',
  MESSAGES_TYPE_SENT = 'messages.{type}.sent',
  MESSAGES_TYPE_FAILED = 'messages.{type}.failed',
  MESSAGES_TYPE_PROVIDER = 'messages.{type}.{provider}',
  MESSAGES_TYPE_PROVIDER_SENT = 'messages.{type}.{provider}.sent',
  MESSAGES_TYPE_PROVIDER_FAILED = 'messages.{type}.{provider}.failed',
  SESSIONS = 'sessions',
  SCHEMAS = 'schemas',
  COLLECTIONS = 'collections',
  SCHEMA_ID_COLLECTIONS = '{schemaId}.collections',
  DOCUMENTS = 'documents',
  SCHEMA_ID_DOCUMENTS = '{schemaId}.documents',
  SCHEMA_ID_COLLECTION_ID_DOCUMENTS = '{schemaId}.{collectionInternalId}.documents',
  BUCKETS = 'buckets',
  FILES = 'files',
  FILES_STORAGE = 'files.storage',
  BUCKET_ID_FILES = '{bucketInternalId}.files',
  BUCKET_ID_FILES_STORAGE = '{bucketInternalId}.files.storage',
  REQUESTS = 'network.requests',
  INBOUND = 'network.inbound',
  OUTBOUND = 'network.outbound',

  FUNCTIONS = 'functions',
  DEPLOYMENTS = 'deployments',
  DEPLOYMENTS_STORAGE = 'deployments.storage',
  BUILDS = 'builds',
  BUILDS_SUCCESS = 'builds.success',
  BUILDS_FAILED = 'builds.failed',
  BUILDS_STORAGE = 'builds.storage',
  BUILDS_COMPUTE = 'builds.compute',
  BUILDS_COMPUTE_SUCCESS = 'builds.compute.success',
  BUILDS_COMPUTE_FAILED = 'builds.compute.failed',
  BUILDS_MB_SECONDS = 'builds.mbSeconds',
  FUNCTION_ID_BUILDS = '{functionInternalId}.builds',
  FUNCTION_ID_BUILDS_SUCCESS = '{functionInternalId}.builds.success',
  FUNCTION_ID_BUILDS_FAILED = '{functionInternalId}.builds.failed',
  FUNCTION_ID_BUILDS_STORAGE = '{functionInternalId}.builds.storage',
  FUNCTION_ID_BUILDS_COMPUTE = '{functionInternalId}.builds.compute',
  FUNCTION_ID_BUILDS_COMPUTE_SUCCESS = '{functionInternalId}.builds.compute.success',
  FUNCTION_ID_BUILDS_COMPUTE_FAILED = '{functionInternalId}.builds.compute.failed',
  FUNCTION_ID_DEPLOYMENTS = '{resourceType}.{resourceInternalId}.deployments',
  FUNCTION_ID_DEPLOYMENTS_STORAGE = '{resourceType}.{resourceInternalId}.deployments.storage',
  FUNCTION_ID_BUILDS_MB_SECONDS = '{functionInternalId}.builds.mbSeconds',
  EXECUTIONS = 'executions',
  EXECUTIONS_COMPUTE = 'executions.compute',
  EXECUTIONS_MB_SECONDS = 'executions.mbSeconds',
  FUNCTION_ID_EXECUTIONS = '{functionInternalId}.executions',
  FUNCTION_ID_EXECUTIONS_COMPUTE = '{functionInternalId}.executions.compute',
  FUNCTION_ID_EXECUTIONS_MB_SECONDS = '{functionInternalId}.executions.mbSeconds',
}

export enum MessageType {
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
}

export enum MessageProvider {
  // push
  FCM = 'fcm',
  APNS = 'apns',
  // sms
  TELESIGN = 'telesign',
  TEXTMAGIC = 'textmagic',
  TWILIO = 'twilio',
  VONAGE = 'vonage',
  MSG91 = 'msg91',
  // mail
  MAILGUN = 'mailgun',
  SENDGRID = 'sendgrid',
  SMTP = 'smtp',
}

export enum ScheduleResourceType {
  MESSAGE = 'message',
}

export enum Status {
  AVAILABLE = 'available',
  FAILED = 'failed',
  STUCK = 'stuck',
  DELETED = 'deleted',
  DELETING = 'deleting',
  PENDING = 'pending',
  PROCESSING = 'processing',
}

export enum DeleteType {
  DATABASES = 'databases',
  DOCUMENT = 'document',
  COLLECTIONS = 'collections',
  PROJECTS = 'projects',
  FUNCTIONS = 'functions',
  DEPLOYMENTS = 'deployments',
  USERS = 'users',
  TEAM_PROJECTS = 'teams_projects',
  EXECUTIONS = 'executions',
  AUDIT = 'audit',
  ABUSE = 'abuse',
  USAGE = 'usage',
  REALTIME = 'realtime',
  BUCKETS = 'buckets',
  INSTALLATIONS = 'installations',
  RULES = 'rules',
  SESSIONS = 'sessions',
  CACHE_BY_TIMESTAMP = 'cacheByTimeStamp',
  CACHE_BY_RESOURCE = 'cacheByResource',
  SCHEDULES = 'schedules',
  TOPIC = 'topic',
  TARGET = 'target',
  EXPIRED_TARGETS = 'invalid_targets',
  SESSION_TARGETS = 'session_targets',
}

export enum AttributeFormat {
  EMAIL = 'email',
  ENUM = 'enum',
  IP = 'ip',
  DATETIME = 'datetime',
  URL = 'url',
  INTEGER = 'integer',
  FLOAT = 'float',
}

export enum Context {
  Project = 'project',
  User = 'user',
  Team = 'team',
  Session = 'session',
  Locale = 'locale',
  ApiKey = 'apiKey',
  Scopes = 'scopes',
  Role = 'role',
  Mode = 'mode',
  AuthType = 'authType',
  Namespace = 'namespace',
}

export enum HashAlgorithm {
  ARGON2 = 'argon2',
  BCRYPT = 'bcrypt',
  MD5 = 'md5',
  SHA = 'sha',
  /**@deprecated - use modern algos instead */ PHPASS = 'phpass',
  SCRYPT = 'scrypt',
  SCRYPT_MOD = 'scryptMod',
  PLAINTEXT = 'plaintext',
}

export enum AuthActivity {
  APP = 'app',
  USER = 'user',
  GUEST = 'guest',
}

export enum SessionProvider {
  EMAIL = 'email',
  ANONYMOUS = 'anonymous',
  MAGIC_URL = 'magic-url',
  PHONE = 'phone',
  OAUTH2 = 'oauth2',
  TOKEN = 'token',
  SERVER = 'server',
}

export enum TokenType {
  VERIFICATION = 2,
  RECOVERY = 3,
  INVITE = 4,
  MAGIC_URL = 5,
  PHONE = 6,
  OAUTH2 = 7,
  GENERIC = 8,
  EMAIL = 9, // OTP
}

export enum AuthFactor {
  EMAIL = 'email',
  PHONE = 'phone',
  TOKEN = 'token',
}

export enum DatabaseRole {
  ADMIN = 'nuvix_admin',
  NUVIX = 'nuvix',
  POSTGRES = 'postgres',
  ANON = 'anon',
  AUTHENTICATED = 'authenticated',
}

export enum RouteContext {
  AUDIT = 'audit',
  RATE_LIMIT = 'rateLimit',
  SKIP_LOGGING = 'skipLogging',
}

export enum MetricPeriod {
  INF = 'inf',
  HOUR = '1h',
  DAY = '1d',
  WEEK = '1w',
  MONTH = '1m',
  YEAR = '1y',
}
