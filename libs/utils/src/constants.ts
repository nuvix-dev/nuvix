import { findProjectRoot } from './helpers'

export const PROJECT_ROOT = findProjectRoot()

export const IS_PUBLIC_KEY = 'isPublic'
export const HOOKS = 'hooks'
export const DEFAULT_DATABASE = 'postgres'

export const CURRENT_SCHEMA_DB: unique symbol = Symbol('currentSchemaDb')
export const CURRENT_SCHEMA_PG: unique symbol = Symbol('currentSchemaPg')

export const APP_DATABASE_ATTRIBUTE_STRING_MAX_LENGTH = 1_073_741_824 // 2^32 bits / 4 bits per char
export const APP_DATABASE_TIMEOUT_MILLISECONDS = 15_000

// Auth Types
export const APP_AUTH_TYPE_SESSION = 'Session'
export const APP_AUTH_TYPE_JWT = 'JWT'
export const APP_AUTH_TYPE_KEY = 'Key'
export const APP_AUTH_TYPE_ADMIN = 'Admin'

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
  Core = 'core',
  System = 'system',
  Internal = 'internal', // used for platform internal stuff
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
  DATABASE = 'database',
  MAILS = 'mails',
  COLLECTIONS = 'collections',
  STATS = 'stats',
  LOGS = 'logs',
  DELETES = 'deletes',
}

export const EVENT_DELIMITER = '.'
export enum AppEvents {
  USER_CREATE = `user${EVENT_DELIMITER}create`,
  USER_DELETE = `user${EVENT_DELIMITER}delete`,
  USER_UPDATE = `user${EVENT_DELIMITER}update`,
  SESSION_CREATE = `session${EVENT_DELIMITER}create`,
  SESSION_DELETE = `session${EVENT_DELIMITER}delete`,
  SESSIONS_DELETE = `sessions${EVENT_DELIMITER}delete`,
  SESSION_UPDATE = `session${EVENT_DELIMITER}update`,
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
  DOCUMENT = 'document',
  COLLECTIONS = 'collections',
  AUDIT = 'audit',
  ABUSE = 'abuse',
  USAGE = 'usage',
  SESSIONS = 'sessions',
  SCHEDULES = 'schedules',
  TOPIC = 'topic',
  TARGET = 'target',
  EXPIRED_TARGETS = 'invalid_targets',
  SESSION_TARGETS = 'session_targets',
}

export enum DeleteDocumentType {
  USERS = 'users',
  BUCKETS = 'buckets',
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
  CurrentSchema = 'currentSchema',
  AuthMeta = 'authMeta',
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
  SCHEMA_TYPE = 'schemaType',
}

export enum MetricPeriod {
  INF = 'inf',
  HOUR = '1h',
  DAY = '1d',
  WEEK = '1w',
  MONTH = '1m',
  YEAR = '1y',
}

export enum MessageStatus {
  /**
   * Message that is not ready to be sent
   */
  DRAFT = 'draft',
  /**
   * Scheduled to be sent for a later time
   */
  SCHEDULED = 'scheduled',
  /**
   * Picked up by the worker and starting to send
   */
  PROCESSING = 'processing',
  /**
   * Sent without errors
   */
  SENT = 'sent',
  /**
   * Sent with some errors
   */
  FAILED = 'failed',
}

export enum SessionType {
  EMAIL_PASSWORD = 'email-password',
  MAGIC_URL = 'magic-url',
  EMAIL_OTP = 'email-otp',
  ANONYMOUS = 'anonymous',
  INVITES = 'invites',
  JWT = 'jwt',
  PHONE = 'phone',
}
