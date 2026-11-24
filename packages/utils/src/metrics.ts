/**
 * Usage metrics primitives — metric keys, aggregation periods, and the
 * deterministic stat-row id hash.
 */

/** Metric keys recorded in per-project usage stats. Placeholders such as `{type}`, `{provider}`, or `{schemaId}` are substituted with concrete values at write time. */
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

/** Aggregation periods persisted per metric. */
export enum MetricPeriod {
  INF = 'inf',
  HOUR = '1h',
  DAY = '1d',
  WEEK = '1w',
  MONTH = '1m',
  YEAR = '1y',
}

/**
 * FNV-1a 128-bit hash used to derive deterministic stat-row ids, so rows
 * for the same metric/period accumulate via create-or-update-with-increment.
 */
export function fnv1a128(str: string): string {
  let hash = BigInt('0x6c62272e07bb014262b821756295c58d') // 128-bit offset basis
  const prime = BigInt('0x0000000001000000000000000000013B') // 128-bit prime

  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i))
    hash = (hash * prime) & ((BigInt(1) << BigInt(128)) - BigInt(1)) // 128-bit overflow
  }

  // Return as fixed 32-char hex string
  return hash.toString(16).padStart(32, '0')
}
