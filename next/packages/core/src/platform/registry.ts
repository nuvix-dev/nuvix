import type { Database, Doc } from '@nuvix/db'
import { Query } from '@nuvix/db'
import type { TenantTarget } from '../tenants'

interface ProjectRecord {
  status: string
  publishableKey: string
  target?: TenantTarget
}

export interface OAuthProviderInfo {
  /** Stable provider key (e.g. `google`, `apple`). */
  key: string
  appId?: string
  /** Secret blob as stored (may be encrypted at rest; decrypted by callers). */
  secret?: string
  enabled?: boolean
}

export interface PlatformInfo {
  type?: string
  hostname?: string | null
  key?: string | null
}

export interface ResolvedProject {
  id: string
  target: TenantTarget
  /**
   * Control-plane extras the project-facing server needs per request:
   * OAuth provider credentials (secrets stay as stored — decrypt with the
   * platform encryption key before use) and registered client platforms
   * (redirect/origin validation). Kept narrow on purpose.
   */
  providers?: OAuthProviderInfo[]
  platforms?: PlatformInfo[]
}

interface KeyRecord {
  projectId: string
  name: string
  scopes: string[]
  secret: string
  expire?: Date | string | null
  accessedAt?: Date | string | null
}

export interface ResolvedApiKey {
  id: string
  projectId: string
  name: string
  scopes: string[]
  expire?: Date | string | null
}

/** Narrow read boundary used by the project-facing server. */
export class ProjectRegistry {
  constructor(private readonly db: Database) {}

  async resolve(publishableKey: string): Promise<ResolvedProject | null> {
    const project = (await this.db
      .system()
      .findOne('projects', (query) =>
        query.equal('publishableKey', publishableKey),
      )) as Doc<ProjectRecord>
    if (project.empty()) return null

    const data = project.toObject()
    if (data.status !== 'active' || !data.target) return null
    return { id: project.getId(), target: data.target }
  }

  /**
   * OAuth2 provider credentials configured for a project (control-plane
   * read). Secrets are returned as stored — decrypt with the platform
   * encryption key before use. Only the account OAuth2 flow reads this.
   */
  async getOAuthProviders(projectId: string): Promise<OAuthProviderInfo[]> {
    try {
      const project = await this.db.system().getDocument('projects', projectId)
      if (project.empty()) return []
      return this.resolveProviders(project.toObject())
    } catch {
      return []
    }
  }

  /**
   * Registered client platforms for a project (control-plane read), used for
   * redirect/origin validation. Best-effort: a missing collection (older
   * control-plane databases) degrades to an empty list instead of failing.
   */
  async getPlatforms(projectId: string): Promise<PlatformInfo[]> {
    try {
      const project = await this.db.system().getDocument('projects', projectId)
      if (project.empty()) return []
      const sequence = project.getSequence()
      if (!sequence) return []
      const rows = await this.db
        .system()
        .find('platforms', [Query.equal('projectInternalId', [sequence])])
      return rows.map((row) => ({
        type: row.get('type') ? String(row.get('type')) : undefined,
        hostname: row.get('hostname') ? String(row.get('hostname')) : null,
        key: row.get('key') ? String(row.get('key')) : null,
      }))
    } catch {
      return []
    }
  }

  /**
   * Per-project auth settings (`projects.auths` record) — session duration,
   * user-count limit, feature gates. Narrow read for account flows.
   */
  async getAuthSettings(projectId: string): Promise<Record<string, unknown> | undefined> {
    try {
      const project = await this.db.system().getDocument('projects', projectId)
      if (project.empty()) return undefined
      const auths = project.get('auths')
      return auths && typeof auths === 'object' ? (auths as Record<string, unknown>) : undefined
    } catch {
      return undefined
    }
  }

  private resolveProviders(data: { oAuthProviders?: unknown }): OAuthProviderInfo[] {
    const raw = data.oAuthProviders
    if (!Array.isArray(raw)) return []
    return raw.map((entry) => {
      const p = entry as Record<string, unknown>
      return {
        key: String(p.key ?? ''),
        appId: p.appId ? String(p.appId) : undefined,
        secret: p.secret ? String(p.secret) : undefined,
        enabled: Boolean(p.enabled),
      }
    })
  }
}

export class KeyRegistry {
  constructor(private readonly db: Database) {}

  async resolve(projectId: string, secret: string): Promise<ResolvedApiKey | null> {
    const session = this.db.system()
    const docs = (await session.find('keys', (query) =>
      query.equal('projectId', projectId),
    )) as Doc<KeyRecord>[]
    if (!docs.length) return null

    const doc = docs.find((d) => d.get('secret') === secret)
    if (!doc || doc.empty()) return null

    const data = doc.toObject()
    if (data.expire) {
      const expireTime = new Date(data.expire as string | Date).getTime()
      if (expireTime < Date.now()) return null
    }

    try {
      doc.set('accessedAt', new Date())
      await session.updateDocument('keys', doc.getId(), doc)
    } catch {
      // Non-blocking telemetry
    }

    return {
      id: doc.getId(),
      projectId: data.projectId,
      name: data.name || 'API Key',
      scopes: Array.isArray(data.scopes) ? data.scopes : [],
      expire: data.expire ?? null,
    }
  }
}
