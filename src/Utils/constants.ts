import { config } from 'dotenv';

config();

export const JWT_SECRET = process.env.JWT_SECRET;
export const PYTHON_API_URL = process.env.PYTHON_API_URL;
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

export const APP_VERSION_STABLE = '1.0.0';
export const APP_FUNCTION_SPECIFICATION_DEFAULT = 'default';
export const APP_OPENSSL_KEY_1 = 'acd3462d9128abcd'; // 16-byte key for AES-128-GCM

export const APP_REDIS_PATH = process.env.APP_REDIS_PATH;
export const APP_REDIS_PORT = parseInt(
  process.env.APP_REDIS_PORT ?? '6379',
  10,
);
export const APP_REDIS_HOST = process.env.APP_REDIS_HOST;
export const APP_REDIS_USER = process.env.APP_REDIS_USER;
export const APP_REDIS_PASSWORD = process.env.APP_REDIS_PASSWORD;
export const APP_REDIS_DB = parseInt(process.env.APP_REDIS_DB ?? '0', 10);
export const APP_REDIS_SECURE = process.env.APP_REDIS_SECURE === 'true';

// Email Config
export const APP_SMTP_HOST = process.env.APP_SMTP_HOST;
export const APP_SMTP_PORT = parseInt(process.env.APP_SMTP_PORT ?? '587', 10);
export const APP_SMTP_SECURE = process.env.APP_SMTP_SECURE === 'true';
export const APP_SMTP_USER = process.env.APP_SMTP_USER;
export const APP_SMTP_PASSWORD = process.env.APP_SMTP_PASSWORD;
export const APP_SMTP_EMAIL_FROM = process.env.APP_SMTP_EMAIL_FROM;
export const APP_SMTP_SENDER = process.env.APP_SMTP_SENDER;
export const APP_SMTP_REPLY_TO = process.env.APP_SMTP_REPLY_TO;
export const APP_SMTP_DKIM_DOMAIN = process.env.APP_SMTP_DKIM_DOMAIN;
export const APP_SMTP_DKIM_KEY = process.env.APP_SMTP_DKIM_KEY;
export const APP_SMTP_DKIM_PRIVATE_KEY = process.env.APP_SMTP_DKIM_PRIVATE_KEY;

export const PROJECT = 'project';
export const USER = 'user';
export const SESSION = 'session';
export const DB_FOR_CONSOLE = 'dbForConsole';
export const DB_FOR_PROJECT = 'dbForProject';
export const GEO_DB = 'geoDb';
export const CACHE_DB = 'cacheDb';
export const IS_PUBLIC_KEY = 'isPublic';
export const LOCALE = 'locale';
export const API_KEY = 'apiKey';
export const SCOPES = 'scopes';

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

export const CONSOLE_CONFIG: any = {
  auths: {},
};
export const SERVER_CONFIG: ServerConfig = {
  host: process.env.APP_HOSTNAME ?? 'localhost',
  methods: 'GET,PUT,PATCH,POST,DELETE',
  allowedOrigins: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim()),
  allowedHeaders: [
    ...allowedHeaders,
    ...(process.env.CORS_HEADERS ?? '')
      .split(',')
      .map((header) => header.trim()),
  ],
  credentials: true,
  exposedHeaders: ['X-Nuvix-Session', 'X-Fallback-Cookies'],
  functionsDomain: process.env.APP_DOMAIN_FUNCTION,
  routerProtection: (process.env.APP_ROUTER_PROTECTION ?? 'true') === 'true',
};

// APP
export const APP_NAME = 'Nuvix';
export const APP_DOMAIN = 'nuvix.io';
export const APP_EMAIL_TEAM = 'team@localhost.test'; // Default email address
export const APP_EMAIL_SECURITY = ''; // Default security email address
export const APP_USERAGENT =
  APP_NAME + '-Server v%s. Please report abuse at %s';
export const APP_MODE_DEFAULT = 'default';
export const APP_MODE_ADMIN = 'admin';
export const APP_PAGING_LIMIT = 12;
export const APP_MAX_COUNT = 1000;
export const APP_LIMIT_COUNT = 5000;
export const APP_LIMIT_USERS = 10_000;
export const APP_LIMIT_USER_PASSWORD_HISTORY = 20;
export const APP_LIMIT_USER_SESSIONS_MAX = 100;
export const APP_LIMIT_USER_SESSIONS_DEFAULT = 10;
export const APP_LIMIT_ANTIVIRUS = 20_000_000; //20MB
export const APP_LIMIT_ENCRYPTION = 20_000_000; //20MB
export const APP_LIMIT_COMPRESSION = 20_000_000; //20MB
export const APP_LIMIT_ARRAY_PARAMS_SIZE = 100; // Default maximum of how many elements can there be in API parameter that expects array value
export const APP_LIMIT_ARRAY_LABELS_SIZE = 1000; // Default maximum of how many labels elements can there be in API parameter that expects array value
export const APP_LIMIT_ARRAY_ELEMENT_SIZE = 4096; // Default maximum length of element in array parameter represented by maximum URL length.
export const APP_LIMIT_SUBQUERY = 1000;
export const APP_LIMIT_SUBSCRIBERS_SUBQUERY = 1_000_000;
export const APP_LIMIT_WRITE_RATE_DEFAULT = 60; // Default maximum write rate per rate period
export const APP_LIMIT_WRITE_RATE_PERIOD_DEFAULT = 60; // Default maximum write rate period in seconds
export const APP_LIMIT_LIST_DEFAULT = 25; // Default maximum number of items to return in list API calls
export const APP_KEY_ACCESS = 24 * 60 * 60; // 24 hours
export const APP_USER_ACCESS = 24 * 60 * 60; // 24 hours
export const APP_PROJECT_ACCESS = 24 * 60 * 60; // 24 hours
export const APP_CACHE_UPDATE = 24 * 60 * 60; // 24 hours
export const APP_CACHE_BUSTER = 4318;
export const APP_DATABASE_ATTRIBUTE_EMAIL = 'email';
export const APP_DATABASE_ATTRIBUTE_ENUM = 'enum';
export const APP_DATABASE_ATTRIBUTE_IP = 'ip';
export const APP_DATABASE_ATTRIBUTE_DATETIME = 'datetime';
export const APP_DATABASE_ATTRIBUTE_URL = 'url';
export const APP_DATABASE_ATTRIBUTE_INT_RANGE = 'intRange';
export const APP_DATABASE_ATTRIBUTE_FLOAT_RANGE = 'floatRange';
export const APP_DATABASE_ATTRIBUTE_STRING_MAX_LENGTH = 1_073_741_824; // 2^32 bits / 4 bits per char
export const APP_DATABASE_TIMEOUT_MILLISECONDS = 15_000;
export const APP_STORAGE_UPLOADS = 'storage/uploads';
export const APP_STORAGE_FUNCTIONS = 'storage/functions';
export const APP_STORAGE_BUILDS = 'storage/builds';
export const APP_STORAGE_CACHE = 'storage/cache';
export const APP_STORAGE_CERTIFICATES = 'storage/certificates';
export const APP_STORAGE_CONFIG = 'storage/config';
export const APP_STORAGE_READ_BUFFER = 20 * (1000 * 1000); //20MB other names `APP_STORAGE_MEMORY_LIMIT`, `APP_STORAGE_MEMORY_BUFFER`, `APP_STORAGE_READ_LIMIT`, `APP_STORAGE_BUFFER_LIMIT`
export const APP_HOSTNAME_INTERNAL =
  process.env.APP_HOSTNAME_INTERNAL ?? 'localhost';
// const APP_FUNCTION_SPECIFICATION_DEFAULT = Specification::S_05VCPU_512MB;
export const APP_FUNCTION_CPUS_DEFAULT = 0.5;
export const APP_FUNCTION_MEMORY_DEFAULT = 512;

// Debug
export const APP_DEBUG_COLORS = process.env.APP_DEBUG_COLORS === 'true';
export const APP_DEBUG_FORMAT = process.env.APP_DEBUG_FORMAT === 'json';

// Mails
export const WORKER_TYPE_MAILS = 'mails';
export const APP_SYSTEM_EMAIL_ADDRESS = 'app@nuvix.io';
export const APP_SYSTEM_EMAIL_NAME = 'Nuvix';
export const SEND_TYPE_EMAIL = 'sendEmail';

// Database Reconnect
export const DATABASE_RECONNECT_SLEEP = 2;
export const DATABASE_RECONNECT_MAX_ATTEMPTS = 10;

// Database Worker Types
export const DATABASE_TYPE_CREATE_ATTRIBUTE = 'createAttribute';
export const DATABASE_TYPE_CREATE_INDEX = 'createIndex';
export const DATABASE_TYPE_DELETE_ATTRIBUTE = 'deleteAttribute';
export const DATABASE_TYPE_DELETE_INDEX = 'deleteIndex';
export const DATABASE_TYPE_DELETE_COLLECTION = 'deleteCollection';
export const DATABASE_TYPE_DELETE_DATABASE = 'deleteDatabase';

// Build Worker Types
export const BUILD_TYPE_DEPLOYMENT = 'deployment';
export const BUILD_TYPE_RETRY = 'retry';

// Deletion Types
export const DELETE_TYPE_DATABASES = 'databases';
export const DELETE_TYPE_DOCUMENT = 'document';
export const DELETE_TYPE_COLLECTIONS = 'collections';
export const DELETE_TYPE_PROJECTS = 'projects';
export const DELETE_TYPE_FUNCTIONS = 'functions';
export const DELETE_TYPE_DEPLOYMENTS = 'deployments';
export const DELETE_TYPE_USERS = 'users';
export const DELETE_TYPE_TEAM_PROJECTS = 'teams_projects';
export const DELETE_TYPE_EXECUTIONS = 'executions';
export const DELETE_TYPE_AUDIT = 'audit';
export const DELETE_TYPE_ABUSE = 'abuse';
export const DELETE_TYPE_USAGE = 'usage';
export const DELETE_TYPE_REALTIME = 'realtime';
export const DELETE_TYPE_BUCKETS = 'buckets';
export const DELETE_TYPE_INSTALLATIONS = 'installations';
export const DELETE_TYPE_RULES = 'rules';
export const DELETE_TYPE_SESSIONS = 'sessions';
export const DELETE_TYPE_CACHE_BY_TIMESTAMP = 'cacheByTimeStamp';
export const DELETE_TYPE_CACHE_BY_RESOURCE = 'cacheByResource';
export const DELETE_TYPE_SCHEDULES = 'schedules';
export const DELETE_TYPE_TOPIC = 'topic';
export const DELETE_TYPE_TARGET = 'target';
export const DELETE_TYPE_EXPIRED_TARGETS = 'invalid_targets';
export const DELETE_TYPE_SESSION_TARGETS = 'session_targets';

// Message types
export const MESSAGE_SEND_TYPE_INTERNAL = 'internal';
export const MESSAGE_SEND_TYPE_EXTERNAL = 'external';
// Mail Types
export const MAIL_TYPE_VERIFICATION = 'verification';
export const MAIL_TYPE_MAGIC_SESSION = 'magicSession';
export const MAIL_TYPE_RECOVERY = 'recovery';
export const MAIL_TYPE_INVITATION = 'invitation';
export const MAIL_TYPE_CERTIFICATE = 'certificate';
// Auth Types
export const APP_AUTH_TYPE_SESSION = 'Session';
export const APP_AUTH_TYPE_JWT = 'JWT';
export const APP_AUTH_TYPE_KEY = 'Key';
export const APP_AUTH_TYPE_ADMIN = 'Admin';
// Response related
export const MAX_OUTPUT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
// Function headers
export const FUNCTION_ALLOWLIST_HEADERS_REQUEST = [
  'content-type',
  'agent',
  'content-length',
  'host',
];
export const FUNCTION_ALLOWLIST_HEADERS_RESPONSE = [
  'content-type',
  'content-length',
];
// Message types
export const MESSAGE_TYPE_EMAIL = 'email';
export const MESSAGE_TYPE_SMS = 'sms';
export const MESSAGE_TYPE_PUSH = 'push';
// API key types
export const API_KEY_STANDARD = 'standard';
export const API_KEY_DYNAMIC = 'dynamic';
// Worker Types
export const WORKER_TYPE_USAGE = 'usage';
// Usage metrics
export const METRIC_TEAMS = 'teams';
export const METRIC_USERS = 'users';

export const METRIC_AUTH_METHOD_PHONE = 'auth.method.phone';
export const METRIC_AUTH_METHOD_PHONE_COUNTRY_CODE =
  METRIC_AUTH_METHOD_PHONE + '.{countryCode}';
export const METRIC_MESSAGES = 'messages';
export const METRIC_MESSAGES_SENT = METRIC_MESSAGES + '.sent';
export const METRIC_MESSAGES_FAILED = METRIC_MESSAGES + '.failed';
export const METRIC_MESSAGES_TYPE = METRIC_MESSAGES + '.{type}';
export const METRIC_MESSAGES_TYPE_SENT = METRIC_MESSAGES + '.{type}.sent';
export const METRIC_MESSAGES_TYPE_FAILED = METRIC_MESSAGES + '.{type}.failed';
export const METRIC_MESSAGES_TYPE_PROVIDER =
  METRIC_MESSAGES + '.{type}.{provider}';
export const METRIC_MESSAGES_TYPE_PROVIDER_SENT =
  METRIC_MESSAGES + '.{type}.{provider}.sent';
export const METRIC_MESSAGES_TYPE_PROVIDER_FAILED =
  METRIC_MESSAGES + '.{type}.{provider}.failed';
export const METRIC_SESSIONS = 'sessions';
export const METRIC_DATABASES = 'databases';
export const METRIC_COLLECTIONS = 'collections';
export const METRIC_DATABASE_ID_COLLECTIONS =
  '{databaseInternalId}.collections';
export const METRIC_DOCUMENTS = 'documents';
export const METRIC_DATABASE_ID_DOCUMENTS = '{databaseInternalId}.documents';
export const METRIC_DATABASE_ID_COLLECTION_ID_DOCUMENTS =
  '{databaseInternalId}.{collectionInternalId}.documents';
export const METRIC_BUCKETS = 'buckets';
export const METRIC_FILES = 'files';
export const METRIC_FILES_STORAGE = 'files.storage';
export const METRIC_BUCKET_ID_FILES = '{bucketInternalId}.files';
export const METRIC_BUCKET_ID_FILES_STORAGE =
  '{bucketInternalId}.files.storage';
export const METRIC_FUNCTIONS = 'functions';
export const METRIC_DEPLOYMENTS = 'deployments';
export const METRIC_DEPLOYMENTS_STORAGE = 'deployments.storage';
export const METRIC_BUILDS = 'builds';
export const METRIC_BUILDS_SUCCESS = 'builds.success';
export const METRIC_BUILDS_FAILED = 'builds.failed';
export const METRIC_BUILDS_STORAGE = 'builds.storage';
export const METRIC_BUILDS_COMPUTE = 'builds.compute';
export const METRIC_BUILDS_COMPUTE_SUCCESS = 'builds.compute.success';
export const METRIC_BUILDS_COMPUTE_FAILED = 'builds.compute.failed';
export const METRIC_BUILDS_MB_SECONDS = 'builds.mbSeconds';
export const METRIC_FUNCTION_ID_BUILDS = '{functionInternalId}.builds';
export const METRIC_FUNCTION_ID_BUILDS_SUCCESS =
  '{functionInternalId}.builds.success';
export const METRIC_FUNCTION_ID_BUILDS_FAILED =
  '{functionInternalId}.builds.failed';
export const METRIC_FUNCTION_ID_BUILDS_STORAGE =
  '{functionInternalId}.builds.storage';
export const METRIC_FUNCTION_ID_BUILDS_COMPUTE =
  '{functionInternalId}.builds.compute';
export const METRIC_FUNCTION_ID_BUILDS_COMPUTE_SUCCESS =
  '{functionInternalId}.builds.compute.success';
export const METRIC_FUNCTION_ID_BUILDS_COMPUTE_FAILED =
  '{functionInternalId}.builds.compute.failed';
export const METRIC_FUNCTION_ID_DEPLOYMENTS =
  '{resourceType}.{resourceInternalId}.deployments';
export const METRIC_FUNCTION_ID_DEPLOYMENTS_STORAGE =
  '{resourceType}.{resourceInternalId}.deployments.storage';
export const METRIC_FUNCTION_ID_BUILDS_MB_SECONDS =
  '{functionInternalId}.builds.mbSeconds';
export const METRIC_EXECUTIONS = 'executions';
export const METRIC_EXECUTIONS_COMPUTE = 'executions.compute';
export const METRIC_EXECUTIONS_MB_SECONDS = 'executions.mbSeconds';
export const METRIC_FUNCTION_ID_EXECUTIONS = '{functionInternalId}.executions';
export const METRIC_FUNCTION_ID_EXECUTIONS_COMPUTE =
  '{functionInternalId}.executions.compute';
export const METRIC_FUNCTION_ID_EXECUTIONS_MB_SECONDS =
  '{functionInternalId}.executions.mbSeconds';
export const METRIC_NETWORK_REQUESTS = 'network.requests';
export const METRIC_NETWORK_INBOUND = 'network.inbound';
export const METRIC_NETWORK_OUTBOUND = 'network.outbound';

export const APP_STORAGE_LIMIT = 100 * 1024 * 1024; // 100MB

// Events
export const EVENT_DELIMITER = '.';
export const EVENT_USER_CREATE = 'user' + EVENT_DELIMITER + 'create';
export const EVENT_USER_DELETE = 'user' + EVENT_DELIMITER + 'delete';
export const EVENT_USER_UPDATE = 'user' + EVENT_DELIMITER + 'update';

export const EVENT_SESSION_CREATE = 'session' + EVENT_DELIMITER + 'create';
export const EVENT_SESSION_DELETE = 'session' + EVENT_DELIMITER + 'delete';
export const EVENT_SESSIONS_DELETE = 'sessions' + EVENT_DELIMITER + 'delete';
export const EVENT_SESSION_UPDATE = 'session' + EVENT_DELIMITER + 'update';
