/**
 * Shared constants: background-job queues, database schema identifiers,
 * and collection attribute typing used across all Nuvix apps.
 */

/**
 * Named queues for background jobs. Each queue is consumed independently;
 * the job name submitted with a payload selects its handler
 * (see `@nuvix/core/queues`).
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

/** Dot separator used to compose hierarchical event names. */
export const EVENT_DELIMITER = '.'

/** Named PostgreSQL schemas referenced by the data APIs. */
export enum Schemas {
  Core = 'core',
  System = 'system',
  Internal = 'internal',
}

/** Lifecycle classification of a schema (managed by the platform vs. user documents). */
export enum SchemaType {
  Managed = 'managed',
  Unmanaged = 'unmanaged',
  Document = 'document',
}

/** Reserved metadata tables that back schema introspection. */
export enum SchemaMeta {
  collections = '_collections',
  attributes = '_attributes',
  indexes = '_indexes',
}

/** Typed value formats recognized for collection attributes. */
export enum AttributeFormat {
  EMAIL = 'email',
  DATETIME = 'datetime',
  ENUM = 'enum',
  IP = 'ip',
  URL = 'url',
  INTEGER = 'integer',
  FLOAT = 'float',
}

/** Lifecycle states for asynchronously processed resources. */
export enum Status {
  AVAILABLE = 'available',
  PROCESSING = 'processing',
  DELETING = 'deleting',
  STALLED = 'stalled',
  FAILED = 'failed',
}
