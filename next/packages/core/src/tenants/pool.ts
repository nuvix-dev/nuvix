import type { ResolvedProject } from '../platform'
import { TenantResource, type TenantResourceDependencies } from './resource'

export interface TenantResourcePoolOptions {
  max?: number
  dependencies?: TenantResourceDependencies
}

/**
 * Bounded LRU of tenant resources. A hit moves the project to the newest
 * position; insertion beyond `max` closes and removes the least-recently-used
 * resource before returning the new one.
 */
export class TenantResourcePool {
  private readonly resources = new Map<string, TenantResource>()
  private readonly max: number
  private readonly dependencies: TenantResourceDependencies

  constructor(options: TenantResourcePoolOptions = {}) {
    this.max = options.max ?? 100
    if (!Number.isInteger(this.max) || this.max < 1) {
      throw new RangeError('Tenant resource pool max must be a positive integer')
    }
    this.dependencies = options.dependencies ?? {}
  }

  async get(project: ResolvedProject): Promise<TenantResource> {
    const existing = this.resources.get(project.id)
    if (existing) {
      this.resources.delete(project.id)
      this.resources.set(project.id, existing)
      return existing
    }

    const resource = new TenantResource(project.id, project.target, this.dependencies)
    this.resources.set(project.id, resource)

    if (this.resources.size > this.max) {
      const oldestId = this.resources.keys().next().value
      if (oldestId !== undefined) {
        const oldest = this.resources.get(oldestId)
        this.resources.delete(oldestId)
        await oldest?.close()
      }
    }

    return resource
  }

  async close(): Promise<void> {
    const resources = [...this.resources.values()]
    this.resources.clear()
    await Promise.all(resources.map((resource) => resource.close()))
  }
}
