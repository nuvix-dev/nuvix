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
