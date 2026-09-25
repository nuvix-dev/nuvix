import type { Database, Doc } from '@nuvix/db'
import type { TenantTarget } from '../tenants'

interface ProjectRecord {
  status: string
  publishableKey: string
  target?: TenantTarget
}

export interface ResolvedProject {
  id: string
  target: TenantTarget
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
