/**
 * Queue names used across Nuvix v2.
 * Mirrors legacy QueueFor enum 1:1.
 */
export enum QueueFor {
  AUDITS = 'audits',
  PROJECTS = 'projects',
  MESSAGING = 'messaging',
  MAILS = 'mails',
  STATS = 'stats',
  LOGS = 'logs',
  DELETES = 'deletes',
  WEBHOOKS = 'webhooks',
  BATCH = 'batch',
}

export const EVENT_DELIMITER = '.'

export enum Schemas {
  Core = 'core',
  System = 'system',
  Internal = 'internal',
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

export enum AttributeFormat {
  EMAIL = 'email',
  DATETIME = 'datetime',
  ENUM = 'enum',
  IP = 'ip',
  URL = 'url',
  INTEGER = 'integer',
  FLOAT = 'float',
}

export enum Status {
  AVAILABLE = 'available',
  PROCESSING = 'processing',
  DELETING = 'deleting',
  STALLED = 'stalled',
  FAILED = 'failed',
}
