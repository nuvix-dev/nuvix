import { AttributeType, type Collection, Database, ID, IndexType } from '@nuvix/db'

/** Control-plane schema shared by the platform writer and server resolver. */
const projects: Collection = {
  $collection: Database.METADATA,
  $id: ID.custom('projects'),
  name: 'Projects',
  documentSecurity: false,
  enabled: true,
  attributes: [
    {
      $id: ID.custom('name'),
      key: 'name',
      type: AttributeType.String,
      size: 128,
      required: true,
    },
    {
      $id: ID.custom('status'),
      key: 'status',
      type: AttributeType.String,
      size: 32,
      required: true,
      default: 'provisioning',
    },
    {
      $id: ID.custom('publishableKey'),
      key: 'publishableKey',
      type: AttributeType.String,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('containerName'),
      key: 'containerName',
      type: AttributeType.String,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('volumeName'),
      key: 'volumeName',
      type: AttributeType.String,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('target'),
      key: 'target',
      type: AttributeType.String,
      size: 8192,
      required: false,
      default: null,
      filters: ['json', 'encrypt'],
    },
    {
      $id: ID.custom('errorMessage'),
      key: 'errorMessage',
      type: AttributeType.String,
      size: 1024,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('auths'),
      key: 'auths',
      type: AttributeType.Json,
      required: false,
      default: {},
    },
    {
      $id: ID.custom('description'),
      key: 'description',
      type: AttributeType.String,
      size: 512,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('services'),
      key: 'services',
      type: AttributeType.Json,
      required: false,
      default: {},
    },
    {
      $id: ID.custom('apis'),
      key: 'apis',
      type: AttributeType.Json,
      required: false,
      default: {},
    },
    {
      $id: ID.custom('oAuthProviders'),
      key: 'oAuthProviders',
      type: AttributeType.Json,
      required: false,
      default: {},
    },
    {
      $id: ID.custom('smtp'),
      key: 'smtp',
      type: AttributeType.Json,
      required: false,
      default: {},
    },
    {
      $id: ID.custom('metadata'),
      key: 'metadata',
      type: AttributeType.Json,
      required: false,
      default: {},
    },
    {
      $id: ID.custom('logo'),
      key: 'logo',
      type: AttributeType.String,
      size: 255,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('url'),
      key: 'url',
      type: AttributeType.String,
      size: 2048,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('templates'),
      key: 'templates',
      type: AttributeType.Json,
      required: false,
      default: {},
    },
  ],
  indexes: [
    {
      $id: ID.custom('publishableKey'),
      key: 'idx_publishable_key',
      type: IndexType.Unique,
      attributes: ['publishableKey'],
    },
  ],
}

const webhooks: Collection = {
  $collection: Database.METADATA,
  $id: ID.custom('webhooks'),
  name: 'Webhooks',
  documentSecurity: false,
  enabled: true,
  attributes: [
    {
      $id: ID.custom('projectInternalId'),
      key: 'projectInternalId',
      type: AttributeType.Integer,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('projectId'),
      key: 'projectId',
      type: AttributeType.String,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('name'),
      key: 'name',
      type: AttributeType.String,
      size: 128,
      required: true,
    },
    {
      $id: ID.custom('url'),
      key: 'url',
      type: AttributeType.String,
      size: 2048,
      required: true,
    },
    {
      $id: ID.custom('httpUser'),
      key: 'httpUser',
      type: AttributeType.String,
      size: 128,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('httpPass'),
      key: 'httpPass',
      type: AttributeType.String,
      size: 256,
      required: false,
      default: null,
      filters: ['encrypt'],
    },
    {
      $id: ID.custom('security'),
      key: 'security',
      type: AttributeType.Boolean,
      required: true,
      default: true,
    },
    {
      $id: ID.custom('events'),
      key: 'events',
      type: AttributeType.String,
      size: 128,
      required: true,
      array: true,
    },
    {
      $id: ID.custom('signatureKey'),
      key: 'signatureKey',
      type: AttributeType.String,
      size: 2048,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('enabled'),
      key: 'enabled',
      type: AttributeType.Boolean,
      required: true,
      default: true,
    },
    {
      $id: ID.custom('logs'),
      key: 'logs',
      type: AttributeType.String,
      size: 1000000,
      required: false,
      default: '',
    },
    {
      $id: ID.custom('attempts'),
      key: 'attempts',
      type: AttributeType.Integer,
      size: 4,
      required: false,
      default: 0,
    },
  ],
  indexes: [
    {
      $id: ID.custom('projectInternalId'),
      key: 'idx_webhook_project_internal_id',
      type: IndexType.Key,
      attributes: ['projectInternalId'],
    },
    {
      $id: ID.custom('projectId'),
      key: 'idx_webhook_project_id',
      type: IndexType.Key,
      attributes: ['projectId'],
    },
  ],
}

/**
 * Webhook delivery log (v1 `webhook_logs` internal collection parity) —
 * one row per delivery attempt, trimmed to the last delivery on reads.
 */
const webhookLogs: Collection = {
  $collection: Database.METADATA,
  $id: ID.custom('webhook_logs'),
  name: 'Webhook Logs',
  documentSecurity: false,
  enabled: true,
  attributes: [
    {
      $id: ID.custom('webhookInternalId'),
      key: 'webhookInternalId',
      type: AttributeType.Integer,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('timestamp'),
      key: 'timestamp',
      type: AttributeType.Timestamptz,
      required: true,
    },
    {
      $id: ID.custom('success'),
      key: 'success',
      type: AttributeType.Boolean,
      required: true,
    },
    {
      $id: ID.custom('statusCode'),
      key: 'statusCode',
      type: AttributeType.Integer,
      size: 4,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('response'),
      key: 'response',
      type: AttributeType.String,
      size: 1000,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('error'),
      key: 'error',
      type: AttributeType.String,
      size: 1000,
      required: false,
      default: null,
    },
  ],
  indexes: [
    {
      $id: ID.custom('webhookInternalId'),
      key: 'idx_webhook_log_webhook',
      type: IndexType.Key,
      attributes: ['webhookInternalId'],
    },
    {
      $id: ID.custom('timestamp'),
      key: 'idx_webhook_log_timestamp',
      type: IndexType.Key,
      attributes: ['timestamp'],
      orders: ['DESC'],
    },
  ],
}

const keys: Collection = {
  $collection: Database.METADATA,
  $id: ID.custom('keys'),
  name: 'Keys',
  documentSecurity: false,
  enabled: true,
  attributes: [
    {
      $id: ID.custom('projectInternalId'),
      key: 'projectInternalId',
      type: AttributeType.Integer,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('projectId'),
      key: 'projectId',
      type: AttributeType.String,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('name'),
      key: 'name',
      type: AttributeType.String,
      size: 128,
      required: true,
    },
    {
      $id: ID.custom('scopes'),
      key: 'scopes',
      type: AttributeType.String,
      size: 128,
      required: true,
      array: true,
    },
    {
      $id: ID.custom('secret'),
      key: 'secret',
      type: AttributeType.String,
      size: 1600,
      required: true,
      filters: ['encrypt'],
    },
    {
      $id: ID.custom('expire'),
      key: 'expire',
      type: AttributeType.Timestamptz,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('accessedAt'),
      key: 'accessedAt',
      type: AttributeType.Timestamptz,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('sdks'),
      key: 'sdks',
      type: AttributeType.String,
      size: 128,
      required: false,
      array: true,
      default: [],
    },
  ],
  indexes: [
    {
      $id: ID.custom('projectInternalId'),
      key: 'idx_key_project_internal_id',
      type: IndexType.Key,
      attributes: ['projectInternalId'],
    },
    {
      $id: ID.custom('projectId'),
      key: 'idx_key_project_id',
      type: IndexType.Key,
      attributes: ['projectId'],
    },
  ],
}

const platforms: Collection = {
  $collection: Database.METADATA,
  $id: ID.custom('platforms'),
  name: 'Platforms',
  documentSecurity: false,
  enabled: true,
  attributes: [
    {
      $id: ID.custom('projectInternalId'),
      key: 'projectInternalId',
      type: AttributeType.Integer,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('projectId'),
      key: 'projectId',
      type: AttributeType.String,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('type'),
      key: 'type',
      type: AttributeType.String,
      size: 32,
      required: true,
    },
    {
      $id: ID.custom('name'),
      key: 'name',
      type: AttributeType.String,
      size: 128,
      required: true,
    },
    {
      $id: ID.custom('key'),
      key: 'key',
      type: AttributeType.String,
      size: 256,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('store'),
      key: 'store',
      type: AttributeType.String,
      size: 256,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('hostname'),
      key: 'hostname',
      type: AttributeType.String,
      size: 256,
      required: false,
      default: null,
    },
  ],
  indexes: [
    {
      $id: ID.custom('projectInternalId'),
      key: 'idx_platform_project_internal_id',
      type: IndexType.Key,
      attributes: ['projectInternalId'],
    },
    {
      $id: ID.custom('projectId'),
      key: 'idx_platform_project_id',
      type: IndexType.Key,
      attributes: ['projectId'],
    },
  ],
}

/**
 * Console (operator) user — the platform app's own identity store.
 * Passwords are Argon2id hashes; accounts are seeded from env at
 * bootstrap (see `apps/platform/src/modules/auth`).
 */
const consoleUsers: Collection = {
  $collection: Database.METADATA,
  $id: ID.custom('console_users'),
  name: 'Console Users',
  documentSecurity: false,
  enabled: true,
  attributes: [
    {
      $id: ID.custom('email'),
      key: 'email',
      type: AttributeType.String,
      size: 255,
      required: true,
    },
    {
      $id: ID.custom('name'),
      key: 'name',
      type: AttributeType.String,
      size: 128,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('passwordHash'),
      key: 'passwordHash',
      type: AttributeType.String,
      size: 255,
      required: true,
    },
  ],
  indexes: [
    {
      $id: ID.custom('email'),
      key: 'idx_console_user_email',
      type: IndexType.Unique,
      attributes: ['email'],
    },
  ],
}

/**
 * Console session — one row per login, storing ONLY the sha256 hash of
 * the opaque refresh token (plus the immediately-previous hash so
 * refresh-token reuse is detectable). Deleting the row revokes the
 * session; access JWTs expire on their own short TTL.
 */
const consoleSessions: Collection = {
  $collection: Database.METADATA,
  $id: ID.custom('console_sessions'),
  name: 'Console Sessions',
  documentSecurity: false,
  enabled: true,
  attributes: [
    {
      $id: ID.custom('userId'),
      key: 'userId',
      type: AttributeType.String,
      size: 255,
      required: true,
    },
    {
      $id: ID.custom('refreshHash'),
      key: 'refreshHash',
      type: AttributeType.String,
      size: 64,
      required: true,
    },
    {
      $id: ID.custom('previousHash'),
      key: 'previousHash',
      type: AttributeType.String,
      size: 64,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('userAgent'),
      key: 'userAgent',
      type: AttributeType.String,
      size: 255,
      required: false,
      default: null,
    },
    {
      $id: ID.custom('expireAt'),
      key: 'expireAt',
      type: AttributeType.Timestamptz,
      required: true,
    },
  ],
  indexes: [
    {
      $id: ID.custom('refreshHash'),
      key: 'idx_console_session_refresh_hash',
      type: IndexType.Unique,
      attributes: ['refreshHash'],
    },
    {
      $id: ID.custom('userId'),
      key: 'idx_console_session_user',
      type: IndexType.Key,
      attributes: ['userId'],
    },
  ],
}

export const platformCollections: Collection[] = [
  projects,
  webhooks,
  webhookLogs,
  keys,
  platforms,
  consoleUsers,
  consoleSessions,
]
