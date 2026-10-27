/**
 * Audit trail service: append-only logging plus per-user/per-resource
 * reads, operating on a caller-provided tenant `Session` so every write
 * inherits the caller's tenant and authorization context.
 *
 * The `audit` collection (see `tenant-auth/collections.ts`) stores one row
 * per audited event: `{ userId (internal sequence), event, resource,
 * userAgent, ip, location, time, data }`. Reads run on the caller's
 * session with authorization already elevated (admin/API-key or system).
 */

import { Doc, Query, type Query as QueryType, type Session } from '@nuvix/db'

export const AUDIT_COLLECTION = 'audit'

export interface AuditLogEntry {
  /** Internal user sequence (`-1` for guest/system actors). */
  userId: number
  event: string
  resource?: string
  userAgent?: string
  ip?: string
  location?: string
  time?: Date
  data?: Record<string, unknown>
}

function toDoc(entry: AuditLogEntry): Doc {
  return new Doc<Record<string, unknown>>({
    userId: entry.userId,
    event: entry.event,
    resource: entry.resource ?? '',
    userAgent: entry.userAgent ?? '',
    ip: entry.ip ?? '',
    location: entry.location ?? '',
    time: entry.time ?? new Date(),
    data: entry.data ?? {},
  }) as unknown as Doc
}

export class AuditService {
  constructor(private readonly session: Session) {}

  /** Writes one audit row. */
  async log(entry: AuditLogEntry): Promise<Doc> {
    return this.session.createDocument(AUDIT_COLLECTION, toDoc(entry))
  }

  /** Writes a batch of audit rows (worker flush path). */
  async logBatch(entries: AuditLogEntry[]): Promise<number> {
    if (entries.length === 0) return 0
    const created = await this.session.createDocuments(AUDIT_COLLECTION, entries.map(toDoc))
    return created.length
  }

  /** All audit rows for a user (internal sequence), newest first. */
  async getLogsByUser(userId: number, queries: QueryType[] = []): Promise<Doc[]> {
    // Caller queries (limit/offset/filters) apply, then the user filter; rows sort newest first.
    return this.session.find(AUDIT_COLLECTION, [
      ...queries,
      Query.equal('userId', [userId]),
      Query.orderDesc(),
    ])
  }

  /** Count of audit rows for a user. */
  async countLogsByUser(userId: number, queries: QueryType[] = []): Promise<number> {
    return this.session.count(AUDIT_COLLECTION, [...queries, Query.equal('userId', [userId])])
  }

  /** All audit rows for a resource (e.g. `team/<id>`), newest first. */
  async getLogsByResource(resource: string, queries: QueryType[] = []): Promise<Doc[]> {
    return this.session.find(AUDIT_COLLECTION, [
      ...queries,
      Query.equal('resource', [resource]),
      Query.orderDesc(),
    ])
  }

  /** Count of audit rows for a resource. */
  async countLogsByResource(resource: string, queries: QueryType[] = []): Promise<number> {
    return this.session.count(AUDIT_COLLECTION, [...queries, Query.equal('resource', [resource])])
  }
}
